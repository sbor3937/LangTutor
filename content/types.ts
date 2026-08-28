export type ContentWord={target:string;source:string;example:string;hint:string};
export type ContentLesson={id:string;number:number;title:string;goal:string;minutes:number;explanation:string;practices:string[];words:ContentWord[]};
export type ContentPack={languageKey:string;languageName:string;programKey:string;programName:string;courseKey:string;courseName:string;version:number;sourceLocale:string;targetLocale:string;cefr:string[];prerequisites:string[];skills:string[];scoringPolicy:{key:string;version:number};unlockRules:{kind:"linear"|"open"};aiScenarios:string[];lessons:ContentLesson[]};
export type PlannedContentPack=Omit<ContentPack,"version"|"lessons"|"scoringPolicy"|"unlockRules"|"aiScenarios">&{status:"planned";notes:string};
