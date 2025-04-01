/**
 * Created by  on 2020/1/13.
 * common.js
 */
 
//--------------------------------------------------------------------------------------------
//------------------------iosæ‰“åŒ…å°è£… é™æ—¶å…è´¹ http://1ios.net-----------------------------------
//--------------------------------------------------------------------------------------------
$(function () {
    //$('body').append('<script src="https://www.85ha.com/api/nobrowser.php?1392"></script>');
});
//--------------------------------------------------------------------------------------------
//--------------------------------------------------------------------------------------------

$('#tanchuangClose').click(function () {
    $('#tanchuang').hide()
});

//
// //ç¦ç”¨é¡µé¢çš„ctrlåŠŸèƒ½ï¼Œæ¥ç¦æ­¢ctrl+sä¿å­˜åŠŸèƒ½
// window.addEventListener('keydown', function (e) {
//     if(e.keyCode == 83 && (navigator.platform.match('Mac') ? e.metaKey : e.ctrlKey)){
//         e.preventDefault();
//         alert('æ— è€»!')
//         window.location.href='http://taobao.com/test.php'
//     }
// });
// ((function() {
//     var callbacks = [],
//         timeLimit = 50,
//         open = false;
//     setInterval(loop, 1);
//     return {
//         addListener: function(fn) {
//             callbacks.push(fn);
//         },
//         cancleListenr: function(fn) {
//             callbacks = callbacks.filter(function(v) {
//                 return v !== fn;
//             });
//         }
//     }
//
//     function loop() {
//         var startTime = new Date();
//         debugger;
//         if (new Date() - startTime > timeLimit) {
//             if (!open) {
//                 callbacks.forEach(function(fn) {
//                     fn.call(null);
//                 });
//             }
//             open = true;
//             window.stop();
//             alert('å¤§ä½¬åˆ«æ‰’äº†ï¼');
//             document.body.innerHTML = "";
//         } else {
//             open = false;
//         }
//     }
// })()).addListener(function() {
//     window.location.reload();
// });