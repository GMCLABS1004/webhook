

async.waterfall([
    function readSetting(cb){
      var set_list =[];
      setting.find({execFlag : true},function(error,res){
        if(error){
          console.log(error);
          return;
        }
        
        for(i=0; i<res.length; i++){
          if(res[i].site.indexOf('bitmex') !== -1){
            set_list.push(res[i]);    
          }
        }
        cb(null, set_list);
      });
    },
    function ticker(set_list, cb){
      
      if(set_list.length > 0){
        
        var requestOptions = setRequestHeader(set_list[0].url, set_list[0].apiKey, set_list[0].secreteKey,'GET','trade','symbol=XBTUSD&count=1&reverse=true');
        request(requestOptions, function(err,responsedata,body){
          if(err){
            console.log(err);
          }
          var obj = JSON.parse(body);
          last_price = obj[0].price;
          cb(null, set_list); 
        })
      }else{
        cb(null, set_list);
      }
    },
    function getPosition(set_list, cb){
      for(i=0; i<set_list.length; i++){
        setTimeout(getPosition_bitmex(set_list[i], function(error, data){
          if(error){
            console.log(error);
            return;
          }
          // console.log("data : ");
          // console.log(data);
          list.push(data);
          if(set_list.length === list.length){
            cb(null);
          }
        }), 0);
      }
    }
  ], function(error, results){
    if(error){
      console.log(error);
    }
    console.log(list);
    
    console.log('last_price : '+ last_price);
    list.sort(function(a,b){ //수량을 오름차순 정렬(1,2,3..)
      return a.site.split('bitmex')[1] - b.site.split('bitmex')[1];
    });
    response.send({last_price : last_price, list : list});
  });