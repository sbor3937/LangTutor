import { describe,expect,it,vi } from "vitest";
import { OpenRouterTutorProvider } from "../server/ai/providers/openrouter";

describe("OpenRouter provider boundary",()=>{
  it("validates structured output and reports provider token fields",async()=>{
    const payload={replyItalian:"Ciao!",replyRussian:"Привет!",original:"Ciao",corrected:"Ciao.",explanationRu:"Верно",naturalVariant:null,nextQuestion:"Come stai?",scenario:"intro",level:"A0"};
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(payload)}}],usage:{prompt_tokens:12,completion_tokens:8,prompt_tokens_details:{cached_tokens:3},completion_tokens_details:{reasoning_tokens:1}}}),{status:200,headers:{"content-type":"application/json"}})) as never;
    const provider=new OpenRouterTutorProvider(fetcher,"test-key");
    const result=await provider.complete({message:"Ciao",scenario:"intro",history:[],unlockedLessonIds:[],model:"test/model",maxOutputTokens:100});
    expect(result.data.replyItalian).toBe("Ciao!");
    expect(result.usage).toEqual({promptTokens:12,completionTokens:8,cachedTokens:3,reasoningTokens:1});
    expect(JSON.parse((fetcher as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string)).not.toHaveProperty("userId");
  });
});
