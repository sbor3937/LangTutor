import {render,screen} from "@testing-library/react";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {afterEach,describe,expect,it,vi} from "vitest";
import {ProgramsPage} from "../client/src/components/ProgramsPage";
import {MemoryRouter} from "react-router-dom";

describe("ProgramsPage",()=>{afterEach(()=>vi.restoreAllMocks());it("groups courses by language and opens program-specific onboarding",async()=>{const fetcher=vi.fn(async()=>new Response(JSON.stringify({courses:[{key:"english-core-a0-a1",name:"English Core A0–A1",version:1,program_key:"english-general",program_name:"Английский для русскоязычных",language_key:"en",language_name:"Английский",lesson_count:5,metadata:{cefr:["A0","A1"]},program_metadata:{prerequisites:[]}}]}),{status:200,headers:{"content-type":"application/json"}}));vi.stubGlobal("fetch",fetcher);render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><ProgramsPage/></MemoryRouter></QueryClientProvider>);expect(await screen.findByRole("heading",{name:"Английский"})).toBeInTheDocument();expect(screen.getByRole("link",{name:"Выбрать программу"})).toHaveAttribute("href","/onboarding/english-core-a0-a1");expect(fetcher).toHaveBeenCalledTimes(1);});});
