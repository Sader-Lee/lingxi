/**模式调整 */
document.addEventListener('DOMContentLoaded', function() {
 
  const themeBtn = document.getElementById("theme-toggle");
  const themeIcon = themeBtn.querySelector("img");
  const transferBtn=document.getElementById("transfer-button");
  const transferIcon=transferBtn.querySelector("img");
  const deleteBtn=document.getElementById("delete-button");
  const deleteIcon=deleteBtn.querySelector("img");

  const iconPaths = {
  transfer: {
    dark: "./assets/paperclip.svg",  
    light: "./assets/paperclipBlack.svg" 
  },
  trash: {
    dark: "./assets/trash.svg",      
    light: "./assets/trashBlack.svg"    
  },
  theme:{
    dark:"./assets/moon.svg",
    light:"./assets/sun.svg"
  }


};

const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
    document.body.classList.add('lightmode'); 
    themeIcon.src =iconPaths.theme.light; 
    transferIcon.src=iconPaths.transfer.light;
    deleteIcon.src=iconPaths.trash.light;
  } else {
    themeIcon.src = iconPaths.theme.dark; 
    transferIcon.src=iconPaths.transfer.dark;
    deleteIcon.src=iconPaths.trash.dark;
     
  }


  themeBtn.onclick = function() {

    const isLightNow=document.body.classList.toggle('lightmode');
    if(isLightNow){
      themeIcon.src =iconPaths.theme.light; 
      transferIcon.src=iconPaths.transfer.light;
      deleteIcon.src=iconPaths.trash.light;
    }
    else{
     themeIcon.src = iconPaths.theme.dark; 
      transferIcon.src=iconPaths.transfer.dark;
      deleteIcon.src=iconPaths.trash.dark;
    }
    localStorage.setItem('theme', isLightNow ? 'light' : 'dark');
  };
});

/**
对话框高度调整
 */
const textarea = document.querySelector('form textarea');

// 自适应高度函数
function adjustTextareaHeight() {
  // 重置高度为自动，计算真实内容高度
  textarea.style.height = 'auto';
  // 设置高度为内容高度（不超过max-height）
  const scrollHeight = textarea.scrollHeight;
  const maxHeight = parseInt(getComputedStyle(textarea).maxHeight);
  textarea.style.height = (scrollHeight > maxHeight ? maxHeight : scrollHeight) + 'px';
}

// 监听输入事件，实时调整高度
textarea.addEventListener('input', adjustTextareaHeight);
// 页面加载时初始化高度
window.addEventListener('load', adjustTextareaHeight);


/**对话框不为空时显示提交按钮 */

document.addEventListener('DOMContentLoaded', function() {
  const input=document.getElementById("question");
  const inputArea = document.querySelector('.input-area');

  input.addEventListener('input', function() {
    const hasContent = input.value.trim() !== '';
    if (hasContent) {
      inputArea.classList.add('has-content'); // 有内容时加类
    } else {
      inputArea.classList.remove('has-content'); // 无内容时移除类
    }
  });
});
