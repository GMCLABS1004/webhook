
//tv action
const doSkip = /*무시*/ {text : "무시", isSkip : true, isStatus : false, isExit : false, isEntry : false}
const doStatus = /*상태값변경 */ {text : "상태값변경", isSkip : true, isStatus : true, isExit : false, isEntry : false}
const doExit = /*탈출 */ {text : "탈출", isSkip : false, isStatus : true, isExit : true, isEntry : false}
const doEntry = /*진입 */ {text : "진입", isSkip : false, isStatus : true, isExit : false, isEntry : true}
const doSwitch = /*스위칭 */ {text : "스위칭", isSkip : false, isStatus : true, isExit : true, isEntry : true}

//트레일링스탑 action
const doTrailExit = /*탈출 */ {text : "트레일링 탈출", isSkip : false, isStatus : false, isExit : true, isEntry : false}


const action_table = [
    {type : 'tv', pgSide : 'Buy', isSide : 'Buy', sigSide : "Buy", /*무시*/ action : doSkip},
    {type : 'tv', pgSide : 'Buy', isSide : 'Buy', sigSide : "Buy Exit", /*탈출 */action : doExit},
    {type : 'tv', pgSide : 'Buy', isSide : 'Buy', sigSide : "Sell", /*스위칭 */action : doSwitch},
    {type : 'tv', pgSide : 'Buy', isSide : 'Buy', sigSide : "Sell Exit", /*무시*/ action : doSkip},
    
    {type : 'tv', pgSide : 'Buy', isSide : 'none', sigSide : "Buy", /*무시*/ action : doSkip},
    {type : 'tv', pgSide : 'Buy', isSide : 'none', sigSide : "Buy Exit", /*상태값변경 */ action : doStatus},
    {type : 'tv', pgSide : 'Buy', isSide : 'none', sigSide : "Sell", /*진입 */ action : doEntry},
    {type : 'tv', pgSide : 'Buy', isSide : 'none', sigSide : "Sell Exit", /*무시*/ action : doSkip},
    
    // {type : 'tv', pgSide : 'Buy', isSide : 'Sell', sigSide : "Buy", /*스위칭 */action : doSwitch},
    // {type : 'tv', pgSide : 'Buy', isSide : 'Sell', sigSide : "Buy Exit", /*무시*/ action : doSkip},
    // {type : 'tv', pgSide : 'Buy', isSide : 'Sell', sigSide : "Sell", /*무시*/ action : doSkip},
    // {type : 'tv', pgSide : 'Buy', isSide : 'Sell', sigSide : "Sell Exit", /*탈출 */action : doExit},
    
    // {type : 'tv', pgSide : 'Sell', isSide : 'Buy', sigSide : "Buy", /*무시*/ action : doSkip},
    // {type : 'tv', pgSide : 'Sell', isSide : 'Buy', sigSide : "Buy Exit", /*탈출 */action : doExit},
    // {type : 'tv', pgSide : 'Sell', isSide : 'Buy', sigSide : "Sell", /*스위칭 */action : doSwitch},
    // {type : 'tv', pgSide : 'Sell', isSide : 'Buy', sigSide : "Sell Exit", /*무시*/ action : doSkip},
    
    {type : 'tv', pgSide : 'Sell', isSide : 'Sell', sigSide : "Buy", /*스위칭 */action : doSwitch},
    {type : 'tv', pgSide : 'Sell', isSide : 'Sell', sigSide : "Buy Exit", /*무시*/ action : doSkip},
    {type : 'tv', pgSide : 'Sell', isSide : 'Sell', sigSide : "Sell", /*무시*/ action : doSkip},
    {type : 'tv', pgSide : 'Sell', isSide : 'Sell', sigSide : "Sell Exit", /*탈출 */action : doExit},
    
    {type : 'tv', pgSide : 'Sell', isSide : 'none', sigSide : "Buy", /*진입 */ action : doEntry},
    {type : 'tv', pgSide : 'Sell', isSide : 'none', sigSide : "Buy Exit", /*무시*/ action : doSkip},
    {type : 'tv', pgSide : 'Sell', isSide : 'none', sigSide : "Sell", /*무시*/ action : doSkip},
    {type : 'tv', pgSide : 'Sell', isSide : 'none', sigSide : "Sell Exit", /*상태값변경 */ action : doStatus},
 
    // {type : 'tv', pgSide : 'Exit', isSide : 'Buy', sigSide : "Buy", /*상태값변경 */ action : doStatus},
    // {type : 'tv', pgSide : 'Exit', isSide : 'Buy', sigSide : "Buy Exit", /*무시*/ action : doSkip},
    // {type : 'tv', pgSide : 'Exit', isSide : 'Buy', sigSide : "Sell", /*스위칭 */action : doSwitch},
    // {type : 'tv', pgSide : 'Exit', isSide : 'Buy', sigSide : "Sell Exit", /*무시*/ action : doSkip},
    
    // {type : 'tv', pgSide : 'Exit', isSide : 'Sell', sigSide : "Buy", /*스위칭 */action : doSwitch},
    // {type : 'tv', pgSide : 'Exit', isSide : 'Sell', sigSide : "Buy Exit", /*무시*/ action : doSkip},
    // {type : 'tv', pgSide : 'Exit', isSide : 'Sell', sigSide : "Sell", /*무시*/ action : doSkip},
    // {type : 'tv', pgSide : 'Exit', isSide : 'Sell', sigSide : "Sell Exit", /*탈출 */action : doExit},
    
    {type : 'tv', pgSide : 'Exit', isSide : 'none', sigSide : "Buy", /*진입 */ action : doEntry},
    {type : 'tv', pgSide : 'Exit', isSide : 'none', sigSide : "Buy Exit", /*무시*/ action : doSkip},
    {type : 'tv', pgSide : 'Exit', isSide : 'none', sigSide : "Sell", /*진입 */ action : doEntry},
    {type : 'tv', pgSide : 'Exit', isSide : 'none', sigSide : "Sell Exit", /*무시*/ action : doSkip},

    {type : 'reentry', pgSide : 'Buy', isSide : 'none', sigSide : "Buy", /*진입 */ action : doEntry},
    {type : 'reentry', pgSide : 'Sell', isSide : 'none', sigSide : "Sell", /*진입 */ action : doEntry},    

    {type : 'trailingStop', pgSide : 'Buy', isSide : 'Buy', sigSide : "Buy Exit", /*탈출 */action : doTrailExit},
    {type : 'trailingStop', pgSide : 'Sell', isSide : 'Sell', sigSide : "Sell Exit", /*탈출 */action : doTrailExit},
]

console.log(decide_action("trailingStop", "Buy", "Buy", "Buy Exit"));

function decide_action(type, pgSide, isSide, sigSide){
    for(var i=0; i<action_table.length; i++){
        if(type === action_table[i].type && pgSide === action_table[i].pgSide && isSide === action_table[i].isSide && sigSide === action_table[i].sigSide){
            return action_table[i].action;
        }
    }
    return doSkip;
}

