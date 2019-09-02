


const restartBtn = document.querySelector('#restartBtn');
const shellInput = document.querySelector('#shellInput');
const restartResult = document.querySelector('#restartResult');
const restartResult2 = document.querySelector('#restartResult2');

restartBtn.onclick = ()=>{
	showMsg('正在发送重启指令。。。');
	restartBtn.disabled = true;
	fetch('/restart').then(data=>data.json()).then((data)=>{
		showMsg(JSON.stringify(data,null,2));
		restartBtn.disabled = false;
	},(error)=>{
		showMsg(JSON.stringify(error,null,2));
		restartBtn.disabled = false;
	});
}

shellInput.onkeypress = (e)=>{
	if(!shellInput.value){
		return;
	}
	if(e.which === 13){
		shellInput.disabled = true;
		let bodyData = JSON.stringify({shell: shellInput.value});
		fetch('/exec',{ method: 'POST', body: bodyData, headers: {'Content-Type': 'application/json'} }).then(data=>data.json()).then((data)=>{
			// showMsg(JSON.stringify(data,null,2),1);
			shellInput.disabled = false;
			shellInput.value='';
		},(error)=>{
			showMsg(JSON.stringify(error,null,2),1);
			shellInput.disabled = false;
			// shellInput.value='';
		});
	}

}

function showMsg(msg, which ) {
	which = which || 0;
	const content = [restartResult, restartResult2][which];
	const pre = document.createElement('pre');
	pre.innerText = msg+'\n';
	content.appendChild(pre);
	content.scrollTop = content.scrollHeight;
}

const socket = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://')+location.host.replace(/:.*$/,'')+(location.port?(':'+location.port):''));

// Connection opened
socket.addEventListener('open', function (event) {
    showMsg('连接服务器成功') 
});

// Listen for messages
socket.addEventListener('message', function (event) {
    console.log('Message from server ', event.data);
    let data = JSON.parse(event.data);
    // showMsg(event.data)
    if(data.type.startsWith('start')){
    	showMsg(data.data);
    }
    if(data.type.startsWith('exec')){
    	showMsg(data.data, 1);
    }
});
