import express from "express";
import rateLimit from "express-rate-limit";
import { tutorRequestSchema } from "../../shared/schemas.js";
import { config } from "../config.js";
import { FamilyService } from "../families/service.js";
import { withUserContext } from "../platform/postgres/client.js";
import { AiGateway, AiPolicyError } from "./gateway.js";
import { DemoTutorProvider } from "./providers/demo.js";
import { OpenRouterTutorProvider } from "./providers/openrouter.js";
import { AiUsageRepository } from "./repository.js";
import type pg from "pg";

const internetTutorSchema=tutorRequestSchema.omit({anonymousId:true}).strict();
export function createAiRouter(pool:pg.Pool){const router=express.Router(),families=new FamilyService(pool),repository=new AiUsageRepository(pool),gateway=new AiGateway(repository,new Map([["demo",new DemoTutorProvider()],["openrouter",new OpenRouterTutorProvider()]]));
  router.use(async(req,res,next)=>{if(config.secureCookies&&req.method!=="GET"&&req.get("origin")!==new URL(config.appUrl).origin)return res.status(403).json({error:{code:"INVALID_ORIGIN",message:"Источник запроса не разрешён"}});const token=req.cookies?.lt_session as string|undefined,auth=token?await families.auth(token):null;if(!auth)return res.status(401).json({error:{code:"UNAUTHENTICATED",message:"Требуется вход"}});res.locals.auth=auth;next();});
  router.post("/tutor",rateLimit({windowMs:60000,limit:15,standardHeaders:true,legacyHeaders:false}),async(req,res)=>{try{const input=internetTutorSchema.parse(req.body),auth=res.locals.auth;const unlocked=await withUserContext(auth.userId,auth.familyId,async client=>(await client.query("SELECT lesson_key FROM learning.lesson_progress WHERE user_id=$1 AND (completion_percent>0 OR completed)",[auth.userId])).rows.map((row)=>row.lesson_key as string));const result=await gateway.tutor(auth.userId,auth.familyId,{...input,unlockedLessonIds:unlocked});res.setHeader("X-Request-Id",result.requestId).json(result);}catch(error){if(error instanceof AiPolicyError)return res.status(error.code.includes("BUDGET")?429:403).json({error:{code:error.code,message:error.code.includes("BUDGET")?"Лимит ИИ исчерпан":"ИИ недоступен по настройкам семьи"}});throw error;}});
  router.get("/usage",async(_req,res)=>{const auth=res.locals.auth;res.json({period:"month",usage:await repository.usage(auth.userId,auth.familyId)});});
  return router;
}
