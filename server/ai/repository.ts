import type pg from "pg";
import { AiPolicyError, type ReservedModel, type TokenUsage } from "./types.js";

const knownPolicyCodes = ["AI_DISABLED","AI_MODEL_NOT_ALLOWED","AI_MODEL_UNAVAILABLE","AI_PRICE_UNAVAILABLE","AI_USER_TOKEN_BUDGET","AI_USER_COST_BUDGET","AI_FAMILY_TOKEN_BUDGET"];
export class AiUsageRepository {
  constructor(private readonly pool: pg.Pool) {}
  async reserve(userId: string, familyId: string | null, requestId: string, preferredModel: string, reservedTokens: number): Promise<ReservedModel> {
    try { return await this.tx(userId, familyId, async (client) => (await client.query("SELECT model_id \"modelId\",model_key \"modelKey\",provider_key \"providerKey\",upstream_model \"upstreamModel\",max_output_tokens \"maxOutputTokens\",price_version_id \"priceVersionId\",prompt_rate \"promptRate\",completion_rate \"completionRate\" FROM ai.reserve_tutor_request($1,$2,$3,$4,$5)",[requestId,userId,familyId,preferredModel,reservedTokens])).rows[0]); }
    catch (error) { const message=error instanceof Error?error.message:"AI_RESERVATION_FAILED"; const code=knownPolicyCodes.find((item)=>message.includes(item)); throw new AiPolicyError(code??"AI_RESERVATION_FAILED"); }
  }
  async settle(userId:string,familyId:string|null,requestId:string,usage:TokenUsage,latencyMs:number,status:"succeeded"|"fallback") { return this.tx(userId,familyId,async(client)=>(await client.query("SELECT ai.settle_tutor_request($1,$2,$3,$4,$5,$6,$7,$8) cost_micros",[requestId,userId,usage.promptTokens,usage.completionTokens,usage.cachedTokens,usage.reasoningTokens,latencyMs,status])).rows[0]); }
  async fail(userId:string,familyId:string|null,requestId:string,code:string,latencyMs:number,status:"failed"|"fallback"="failed") { return this.tx(userId,familyId,async(client)=>client.query("SELECT ai.fail_tutor_request($1,$2,$3,$4,$5)",[requestId,userId,code,latencyMs,status])); }
  async usage(userId:string,familyId:string|null){return this.tx(userId,familyId,async(client)=>(await client.query("SELECT coalesce(sum(prompt_tokens),0)::bigint prompt_tokens,coalesce(sum(completion_tokens),0)::bigint completion_tokens,coalesce(sum(cost_micros),0)::bigint cost_micros FROM ai.usage_ledger WHERE user_id=$1 AND created_at>=date_trunc('month',now())",[userId])).rows[0]);}
  private async tx<T>(userId:string,familyId:string|null,fn:(client:pg.PoolClient)=>Promise<T>){const client=await this.pool.connect();try{await client.query("BEGIN");await client.query("SELECT set_config('app.user_id',$1,true),set_config('app.family_id',$2,true)",[userId,familyId??""]);const value=await fn(client);await client.query("COMMIT");return value;}catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}}
}
