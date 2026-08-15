export function weightedAverageCost(currentQuantity:number,currentAverageCost:number,receivedQuantity:number,receivedUnitCost:number){
  if(currentQuantity<0||currentAverageCost<0||receivedQuantity<=0||receivedUnitCost<0)throw new Error("Invalid inventory valuation input");
  return ((currentQuantity*currentAverageCost)+(receivedQuantity*receivedUnitCost))/(currentQuantity+receivedQuantity);
}
export function inventoryValuation(availableQuantity:number,averageCost:number,sellingPrice:number){
  const costValue=availableQuantity*averageCost,retailValue=availableQuantity*sellingPrice;
  return{costValue,retailValue,potentialGrossMargin:retailValue-costValue};
}
