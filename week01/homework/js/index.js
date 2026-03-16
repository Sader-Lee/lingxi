
document.addEventListener('DOMContentLoaded', function() {
  // 模式调整 
  const themeBtn = document.getElementById("theme-toggle");
  const themeIcon = themeBtn.querySelector("img");
  const transferBtn = document.getElementById("transfer-button");
  const transferIcon = transferBtn.querySelector("img");
  const deleteBtn = document.getElementById("delete-button");
  const deleteIcon = deleteBtn.querySelector("img");

  const iconPaths = {
    transfer: {
      dark: "./assets/paperclip.svg",
      light: "./assets/paperclipBlack.svg"
    },
    trash: {
      dark: "./assets/trash.svg",
      light: "./assets/trashBlack.svg"
    },
    theme: {
      dark: "./assets/moon.svg",
      light: "./assets/sun.svg"
    }
  };

  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
    document.body.classList.add('lightmode');
    themeIcon.src = iconPaths.theme.light;
    transferIcon.src = iconPaths.transfer.light;
    deleteIcon.src = iconPaths.trash.light;
  } else {
    themeIcon.src = iconPaths.theme.dark;
    transferIcon.src = iconPaths.transfer.dark;
    deleteIcon.src = iconPaths.trash.dark;
  }

  themeBtn.onclick = function() {
    const isLightNow = document.body.classList.toggle('lightmode');
    themeIcon.src = isLightNow ? iconPaths.theme.light : iconPaths.theme.dark;
    transferIcon.src = isLightNow ? iconPaths.transfer.light : iconPaths.transfer.dark;
    deleteIcon.src = isLightNow ? iconPaths.trash.light : iconPaths.trash.dark;
    localStorage.setItem('theme', isLightNow ? 'light' : 'dark');
  };







  // 对话框高度调整 
  const textarea = document.querySelector('form textarea');
  const inputArea = document.querySelector('.input-area');
  const fileInput = document.getElementById("image-input");
  const previewContainer = document.getElementById('preview-container');
  const previewImage = document.getElementById('preview-image');
  const submitBtn = document.getElementById("submit-button");
  const imageViewer = document.getElementById('image-viewer');
  const largeImage = document.getElementById('large-image');



  function adjustTextareaHeight() {
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const maxHeight = parseInt(getComputedStyle(textarea).maxHeight);
    textarea.style.height = (scrollHeight > maxHeight ? maxHeight : scrollHeight) + 'px';
  }







  //  统一更新按钮状态（文字+图片） 
  function updateButtonState() {
    const hasText = textarea.value.trim() !== '';
    const hasFile = fileInput.files.length > 0;
    const hasContent=hasText||hasFile;

   if (hasContent) {
      inputArea.classList.add('has-content');
      
      if (hasFile) {
        transferBtn.style.display = 'none';
        previewContainer.style.display = 'block'; 
      } else {
        transferBtn.style.display = 'flex';
        previewContainer.style.display = 'none'; 
      }
      submitBtn.style.display = 'flex';
    } else {
      inputArea.classList.remove('has-content');
      transferBtn.style.display = 'flex'; 
      previewContainer.style.display = 'none'; 
      submitBtn.style.display = 'none';
    }
    
  }

  //  绑定事件 
  // 文字输入：同时调整高度、更新按钮状态
  textarea.addEventListener('input', function() {
    adjustTextareaHeight();
    updateButtonState();
  });

  
 // 触发文件选择
  transferBtn.addEventListener("click", function() {
    
    fileInput.click();
    console.log('按钮被点击了');
  });
  // 文件选择
  fileInput.addEventListener('change', function(e) {


  const file = e.target.files[0];
 
  if (!file) return; 

    if (!file.type.startsWith('image/')) {
      alert('请选择jpg/png等图片格式！');
      return;
    }

  const reader = new FileReader();
  reader.onload = function(event) {

    previewImage.src = event.target.result;
    previewContainer.style.display = 'block';
    transferBtn.style.display = 'none';
     updateButtonState();
     largeImage.src = event.target.result;

  };

  reader.readAsDataURL(file);

});

//  查看全图 
previewContainer.addEventListener('click', function() {

  imageViewer.style.display = 'flex';
});
//关闭大图
imageViewer.addEventListener('click', function() {
    imageViewer.style.display = 'none';
});

  //5. 提交按钮点击事件
  submitBtn.addEventListener('click', function() {
    e.preventDefault();
    if (textarea.value.trim() || fileInput.files[0]) {
      
      textarea.value = '';
      fileInput.value = '';
      
      previewContainer.style.display = 'none';
      adjustTextareaHeight(); 
      updateButtonState();    
    }
  });

  // 6. 页面初始化 
  adjustTextareaHeight(); 
  updateButtonState();    
});