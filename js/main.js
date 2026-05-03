function showToast(message) {
    var toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(function() {
            toast.classList.remove('show');
        }, 2000);
    }
}

function showCall120() {
    showToast('正在拨打120...');
}

function showArrived() {
    showToast('感谢您参与救援！任务已完成');
}