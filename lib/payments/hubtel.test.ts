import{describe,expect,it}from"vitest";import{mapHubtelStatus}from"./hubtel";
describe("Hubtel status mapping",()=>{it.each([["Success","paid"],["Paid","paid"],["Failed","failed"],["Cancelled","cancelled"],["Processing","pending"]])("maps %s",(input,expected)=>expect(mapHubtelStatus(input)).toBe(expected));});
