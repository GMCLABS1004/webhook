console.log(fixed4(0.12345678))
function fixed4(num){
    var str = new String(num);
    var arr = str.split(".");
    var str2 = arr[1].slice(0,4);
    return Number(arr[0] + '.' + str2);
}