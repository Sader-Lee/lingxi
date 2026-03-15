
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