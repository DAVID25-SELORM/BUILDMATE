export type CalculatorKind="blocks"|"concrete"|"cement_sand"|"paint"|"tiles"|"roofing"|"plaster";
export type EstimateInput={length:number;width:number;height:number;openings:number;waste:number;unitPrice:number};
export type RelatedEstimate={quantity:number;unit:string;label:string};
export type Estimate={quantity:number;unit:string;label:string;cost:number;details:string[];related?:RelatedEstimate[]};
const positive=(value:number)=>Number.isFinite(value)&&value>0?value:0;
const wasteFactor=(waste:number)=>1+Math.min(Math.max(positive(waste),0),50)/100;
const roundUp=(value:number,precision=0)=>{const factor=10**precision;return Math.ceil(value*factor-1e-9)/factor};

export function calculateMaterial(kind:CalculatorKind,input:EstimateInput):Estimate{
 const length=positive(input.length),width=positive(input.width),height=positive(input.height),openings=positive(input.openings),factor=wasteFactor(input.waste),price=positive(input.unitPrice);
 if(!length||(!["blocks","plaster"].includes(kind)&&!width))throw new Error("Enter dimensions greater than zero.");
 let quantity=0,unit="",label="",details:string[]=[];
 if(kind==="blocks"){
  if(!height)throw new Error("Enter the wall height.");
  const net=Math.max(length*height-openings,0);quantity=roundUp(net*10*factor);unit="blocks";label="Sandcrete blocks";details=[`Net wall area: ${net.toFixed(2)} m²`,`Assumption: 10 standard blocks per m²`];
 }else if(kind==="concrete"){
  if(!height)throw new Error("Enter concrete thickness/depth.");
  const volume=length*width*height;quantity=roundUp(volume*factor,2);unit="m³";label="Ready-mix concrete";details=[`Base volume: ${volume.toFixed(2)} m³`,`Depth entered in metres`];
 }else if(kind==="cement_sand"){
  const mortarVolume=length,sandParts=width;
  if(sandParts<2||sandParts>8)throw new Error("Enter a sand ratio between 2 and 8 parts.");
  const dryVolume=mortarVolume*1.33*factor,cementVolume=dryVolume/(1+sandParts),sandVolume=dryVolume-cementVolume;
  quantity=roundUp(cementVolume*1440/50);unit="50 kg bags";label="Cement";
  details=[`Target wet mortar volume: ${mortarVolume.toFixed(2)} m³`,`Assumed mix: 1 part cement to ${sandParts} parts sand`,`Dry-volume factor: 1.33`,`Sand required: ${roundUp(sandVolume,2).toFixed(2)} m³`];
  return{quantity,unit,label,cost:roundUp(quantity*price,2),details,related:[{quantity:roundUp(sandVolume,2),unit:"m³",label:"Sand"}]};
 }else if(kind==="paint"){
  const area=Math.max(length*width-openings,0);quantity=roundUp((area*2/10)*factor,1);unit="litres";label="Paint";details=[`Paintable area: ${area.toFixed(2)} m²`,`Assumption: 2 coats, 10 m² per litre`];
 }else if(kind==="tiles"){
  const area=length*width;quantity=roundUp(area*factor,2);unit="m²";label="Tiles";details=[`Floor/wall area: ${area.toFixed(2)} m²`,`Order by coverage shown on the tile carton`];
 }else if(kind==="roofing"){
  const area=length*width;quantity=roundUp(area*1.15*factor,2);unit="m²";label="Roofing sheets";details=[`Plan area: ${area.toFixed(2)} m²`,`Includes a 15% pitch/lap allowance before waste`];
 }else{
  if(!height)throw new Error("Enter the wall height.");
  const net=Math.max(length*height-openings,0);quantity=roundUp(net*factor,2);unit="m²";label="Plastering coverage";details=[`Net wall area: ${net.toFixed(2)} m²`,`Quantity is finished surface coverage`];
 }
 return{quantity,unit,label,cost:roundUp(quantity*price,2),details};
}
