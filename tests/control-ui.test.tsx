import {fireEvent,render,screen} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
import {ControlPage} from "../client/src/components/ControlPage";

describe("ControlPage",()=>{afterEach(()=>vi.restoreAllMocks());it("exposes MFA verification with keyboard and a text status",async()=>{vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({enabled:true}),{status:200,headers:{"content-type":"application/json"}})));render(<ControlPage/>);expect(await screen.findByRole("heading",{name:"Super Admin"})).toBeInTheDocument();const input=screen.getByLabelText("Код MFA");fireEvent.change(input,{target:{value:"123456"}});expect(input).toHaveValue("123456");expect(screen.getByRole("status")).toHaveTextContent("Введите код");expect(screen.getByRole("button",{name:"Открыть короткую сессию"})).toBeEnabled();});});
