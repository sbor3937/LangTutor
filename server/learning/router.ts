import express from "express";
import type pg from "pg";
import {z} from "zod";
import { enrollmentSchema, learningAttemptSchema, learningProgressSchema, vocabularyInputSchema } from "../../shared/learning-api-schemas.js";
import { config } from "../config.js";
import { FamilyService } from "../families/service.js";
import { LearningService } from "./service.js";

export function createLearningRouter(pool:pg.Pool){const router=express.Router(),families=new FamilyService(pool),learning=new LearningService(pool);
  router.use(async(req,res,next)=>{if(config.secureCookies&&req.method!=="GET"&&req.get("origin")!==new URL(config.appUrl).origin)return res.status(403).json({error:{code:"INVALID_ORIGIN",message:"Источник запроса не разрешён"}});const token=req.cookies?.lt_session as string|undefined,auth=token?await families.auth(token):null;if(!auth)return res.status(401).json({error:{code:"UNAUTHENTICATED",message:"Требуется вход"}});res.locals.auth=auth;next();});
  router.get("/catalog",async(_req,res)=>res.json({courses:await learning.catalog()}));
  router.get("/courses/:courseKey",async(req,res)=>res.json(await learning.course(z.string().regex(/^[a-z0-9-]{3,100}$/).parse(req.params.courseKey))));
  router.post("/enrollments",async(req,res)=>res.status(201).json(await learning.enroll(res.locals.auth.userId,res.locals.auth.familyId,enrollmentSchema.parse(req.body).courseKey)));
  router.get("/progress",async(_req,res)=>res.json({lessons:await learning.progress(res.locals.auth.userId,res.locals.auth.familyId)}));
  router.put("/progress",async(req,res)=>res.json(await learning.saveProgress(res.locals.auth.userId,res.locals.auth.familyId,learningProgressSchema.parse(req.body))));
  router.post("/attempts",async(req,res)=>res.status(201).json(await learning.submitAttempt(res.locals.auth.userId,res.locals.auth.familyId,learningAttemptSchema.parse(req.body))));
  router.post("/vocabulary",async(req,res)=>res.status(201).json(await learning.addVocabulary(res.locals.auth.userId,res.locals.auth.familyId,vocabularyInputSchema.parse(req.body))));
  return router;}
