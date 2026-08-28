import crypto from "node:crypto";
import { config } from "../config.js";
import { AiUsageRepository } from "./repository.js";
import { AiPolicyError, AiProviderError, type TutorProvider, type TutorProviderInput } from "./types.js";

class Semaphore { private active=0; private readonly waiters:Array<()=>void>=[]; constructor(private readonly limit:number){} async run<T>(fn:()=>Promise<T>){if(this.active>=this.limit)await new Promise<void>((resolve)=>this.waiters.push(resolve));this.active++;try{return await fn();}finally{this.active--;this.waiters.shift()?.();}} }
type Circuit={failures:number;openUntil:number};
export class AiGateway {
  private readonly semaphore=new Semaphore(config.aiConcurrency);
  private readonly circuits=new Map<string,Circuit>();
  constructor(private readonly repository:AiUsageRepository,private readonly providers:Map<string,TutorProvider>){}
  async tutor(userId:string,familyId:string|null,input:Omit<TutorProviderInput,"model"|"maxOutputTokens">){
    const requestId=crypto.randomUUID(),preferred=config.liveAI&&config.openrouterKey?config.aiModelKey:"demo/italian-a0";
    const reserved=await this.repository.reserve(userId,familyId,requestId,preferred,config.aiReservedTokens);
    const provider=this.providers.get(reserved.providerKey); if(!provider){await this.repository.fail(userId,familyId,requestId,"PROVIDER_NOT_REGISTERED",0);throw new AiProviderError("PROVIDER_NOT_REGISTERED",false);}
    const started=Date.now();
    try{
      if(this.isOpen(provider.key))throw new AiProviderError("CIRCUIT_OPEN",true);
      const providerInput={...input,model:reserved.upstreamModel,maxOutputTokens:reserved.maxOutputTokens};
      let result;
      try{result=await this.semaphore.run(()=>provider.complete(providerInput));}
      catch(error){if(!(error instanceof AiProviderError)||!error.retryable)throw error;result=await this.semaphore.run(()=>provider.complete(providerInput));}
      this.success(provider.key);await this.repository.settle(userId,familyId,requestId,result.usage,Date.now()-started,"succeeded");
      return{...result.data,mode:provider.key==="demo"?"demo":"live",requestId};
    }catch(error){const code=error instanceof AiProviderError?error.code:"AI_PROVIDER_FAILURE";this.failure(provider.key);await this.repository.fail(userId,familyId,requestId,code,Date.now()-started,"fallback");const demo=this.providers.get("demo");if(!demo)throw error;const fallback=await demo.complete({...input,model:"demo/italian-a0",maxOutputTokens:500});return{...fallback.data,mode:"fallback",requestId,safeErrorCode:code};}
  }
  private isOpen(key:string){return(this.circuits.get(key)?.openUntil??0)>Date.now();}
  private success(key:string){this.circuits.delete(key);}
  private failure(key:string){const current=this.circuits.get(key)??{failures:0,openUntil:0},failures=current.failures+1;this.circuits.set(key,{failures,openUntil:failures>=config.aiCircuitFailures?Date.now()+config.aiCircuitResetMs:0});}
}
export { AiPolicyError };
