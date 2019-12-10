var request = require('request');
var crypto = require('crypto');
var async = require('async');
var mongoose = require('mongoose');
var webSetting = require('./webSetting.json');
var order_unfilled = require('./models/order_unfilled');
var orderDB = require('./models/order');
var margin = require('./models/margin');
mongoose.connect(webSetting.dbPath, function(error){
    mongoose.set('useFindAndModify', false);

    // order_unfilled.findOneAndRemove({orderID : "13ff53ac-27ff-e8b4-3eac-5d14740d3210"}, function(error, json){
    //     if(error){
    //         console.log(error);
    //         return;
    //     }
    //     if(json === null){ //조회결과 없으면
    //         return;
    //     }

    //     console.log(json);
    // });
});


setTimeout(move_unfilled_to_filled('bitmex2', '881cc5d5-cb50-9cd1-46c9-9231102020eb'), 2000);


function move_unfilled_to_filled(site, orderID){
    return function(){
        var data = {};
        var walletBalance = 0;
        async.waterfall([
            function remove_unfilled_order(cb){
                order_unfilled.findOneAndRemove({orderID : orderID}, function(error, json){
                    if(error){
                        console.log(error);
                        return;
                    }
                    if(json === null){ //조회결과 없으면
                        return;
                    }
                    console.log(json);
                    data = new Object(json);
                    cb(null);
                });
            },
            function get_wallet_balance(cb){
                margin.findOne({site : site}, function(error, json){
                    if(error){
                        console.log(error);
                        return;
                    }

                    console.log(json);
                    walletBalance =json.walletBalance;
                    cb(null);
                });
            },
            function insert_filled_order(cb){
                var totalOrdValue = data.orderQty / data.price
                var obj={
                    site : site,
                    symbol : 'XBTUSD',
                    totalAsset : walletBalance,//walletBalance, //총자산
                    type : getType(data.side), //진입
                    side : data.side, //Buy or Sell
                    side_num : 0,
                    start_price : fixed1(data.price), //가격
                    end_price :  fixed1(data.price), //가격
                    price :  fixed1(data.price), //가격
                    amount : data.orderQty, //수량
                    value : fixed4(totalOrdValue), //가치
                    feeRate : 0.075 * 0.01,
                    fee : fixed8(totalOrdValue * (0.075 * 0.01) ),
                    benefit : 0,
                    benefitRate : 0,
                    div_cnt : 1,
                    start_time : new Date().getTime() + (1000 * 60 * 60 * 9),
                    end_time : new Date().getTime() + (1000 * 60 * 60 * 9),
                    type_log : "dilute",
                    isSend : false //telegram 전송여부
                }
                orderDB.insertMany(obj, function(error, res){
                    if(error){
                        console.log(error);
                        return;
                    }
                    console.log(res);
                    cb(null);
                });
            },

        ], function(error, results){
            if(error){
                console.log(error);
                return;
            }
        })
    }
}

function getType(side){
    if(side ==='Buy' || side ==='bid'){
        return 'long'
    }else if(side ==='Sell' || side ==='ask'){
        return 'short'
    }
  }


function fixed8(num){
    var str = new String(num);
    var arr = str.split(".");
	if(arr.length>1){
		    var str2 = arr[1].slice(0,8);
    	return Number(arr[0] + '.' + str2);	
	}
	return Number(arr[0])
}

function fixed4(num){
    var str = new String(num);
    var arr = str.split(".");
	if(arr.length>1){
		    var str2 = arr[1].slice(0,4);
    	return Number(arr[0] + '.' + str2);	
	}
	return Number(arr[0])
}

function fixed1(num){
    var str = new String(num);
    var arr = str.split(".");
    if(arr.length>1){
        var str2 = arr[1].slice(0,1);
        return Number(arr[0] + '.' + str2);	
    }
    return Number(arr[0]);
}

function fixed2(num){
    var str = new String(num);
    var arr = str.split(".");
    if(arr.length>1){
        var str2 = arr[1].slice(0,2);
        return Number(arr[0] + '.' + str2);	
    }
    return Number(arr[0]);
}