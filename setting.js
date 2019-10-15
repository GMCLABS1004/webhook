var mongoose = require('mongoose');
var settings = require("./models/setting");
var orderDB = require('./models/order');
var orderDB2 = require('./models/order_avg');
var webSetting = require('./webSetting.json');
var list = [];
mongoose.connect(webSetting.dbPath, function(error){
    if(error){
      console.log(error);
      return;
    }
    setTimeout(check_order_complete("korean", 2),3000);
});

function check_order_complete(site_type, scriptNo){
    return function(){
        settings.find({},function(error, res){
            if(error){
                console.log(error);
                return;
            }
            var retryFalg = false;
            for(i=0; i<res.length; i++){
                if(res[i].site_type === site_type && res[i].scriptNo === scriptNo && res[i].execFlag === true){
                    console.log(res[i]);
                    list.push(res[i]);
                }
            }
            if(list.length > 0){
                for(i=0; i<list.length; i++){
                    if(list[i].isExiting === true || list[i].isEntering === true){
                        retryFalg = true;
                    }
                }

                if(retryFalg === true){
                    setTimeout(check_order_complete(site_type, scriptNo),3000);
                }else{
                    setTimeout(insert_trade_history(list), 3000);
                }
            }else{
                console.log("목록없음 로직종료");
            }
        });
    }
}

function insert_trade_history(list){
    return function(){
        var search_list = [];
        var order_list=[];
        for(i=0; i<list.length; i++){
            search_list.push({site : list[i].site});
        }

        for(i=0; i<search_list.length; i++){
            console.log(search_list[i]);
            orderDB.find(search_list[i]).sort({start_time : "desc"}).limit(1).exec(function(error,data){
                if(error){
                    console.log(error);
                    return;
                }
                console.log("주문데이터");
                console.log(data);
                console.log(data[0].start_time)
                console.log(typeof(data[0].start_time));
                console.log(data[0].start_time.getTime());
                if(data.length > 0){
                    order_list.push(data[0]);
                }
    
                if(search_list.length === order_list.length){
                    var obj = create_history_data(order_list);
                    
                    console.log(obj);
                    orderDB2.insertMany(obj, function(error, res){
                        if(error){
                            console.log(error);
                            return;
                        }
                        console.log(res);
                    });
                }
            });
        }
    }
}

function create_history_data(list){
    var obj ={
        totalAsset : 0,
        amount : 0,
        value : 0
    }

    for(i=0; i<list.length; i++){
        obj.totalAsset += list[i].totalAsset;
        obj.amount += list[i].amount;
        obj.value += list[i].value;
    }
    
    obj.type = list[0].type;
    obj.side = list[0].side;
    obj.price = Math.floor(obj.value / obj.amount);
    obj.start_time = filter_prior(new Object(list), "start_time", function(a,b){ return a.start_time.getTime() - b.start_time.getTime()});  
    obj.end_time = filter_prior(new Object(list), "end_time", function(a,b){ return b.end_time.getTime() - a.end_time.getTime()});
    obj.start_price = filter_prior(new Object(list), "start_price", function(a,b){ return a.start_price - b.start_price});  
    obj.end_price = filter_prior(new Object(list), "end_price", function(a,b){ return b.end_price - a.end_price});
    return obj;
}


function filter_prior(list, attrName, predicate){
    list.sort(predicate);
    return list[0][attrName];
}

// function filter(list, predicate){
//     var new_list = [];
//     for(i=0; i<list.length; i++){
//       if(predicate(list[i])){
//         new_list.push(list[i]);
//       }
//     }
//     return new_list;
// }

