var current = new Date().getTime()
var last = new Date().getTime() + (1000 * 60)

var block_signal = [
    {
        "scriptNo" : 203, 
        "side" : "Sell Exit", 
        "side_num" : 1, 
        "site" : "bitmex10", 
        "log" : "", 
        "type_log" : "trailingStop", 
        "timestamp" : new Date().getTime()
    },
    {
        "scriptNo" : 204, 
        "side" : "Sell Exit", 
        "side_num" : 1, 
        "site" : "bitmex10", 
        "log" : "", 
        "type_log" : "trailingStop", 
        "timestamp" : new Date().getTime()
    }
]; 


var signal = {
    "scriptNo" : 203, 
    "side" : "Sell Exit", 
    "side_num" : 1, 
    "site" : "bitmex10", 
    "log" : "", 
    "type_log" : "trailingStop", 
    "timestamp" : (new Date().getTime() + (1000 * 61))
}

console.log(is_insert_signal(signal));

function is_insert_signal(signal){
    console.log(block_signal);
    var removeIdx = -1;
    var before = -1;
    for(i=0; i<block_signal.length; i++){
        //동일 신호 검색
        if(block_signal[i].type_log === signal.type_log && block_signal[i].scriptNo === signal.scriptNo && block_signal[i].side === signal.side && block_signal[i].side_num === signal.side_num && block_signal[i].site === signal.site){
            before = block_signal[i].timestamp;
            current = signal.timestamp;
            
            if((current - before) >= (1000 * 60)){ //1분이상된 신호 

                removeIdx = i; //인덱스 기억 
                
            }else{
                // console.log("신호무시");
                // console.log(block_signal);
                return false; //1분이하 신호 -> 신호무시
            }
        }
    }

    if(removeIdx === -1){ //신호가 처음인 경우
        block_signal.push(signal); //신호 입력
        // console.log("첫신호입력");
        // console.log(block_signal);
        return true;
    }

    if(removeIdx >= 0){ //찾았는데 1분이상 경과된 신호
        block_signal.splice(removeIdx, 1); //이전신호 지우고
        block_signal.push(signal); //새신호로 입력
        // console.log("신호갱신");
        // console.log(block_signal);
        return true;
    }

    return false; 
}