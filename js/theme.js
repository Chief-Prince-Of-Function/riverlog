const THEME_STORAGE_KEY = "riverlog-theme";

const themeToggle = document.getElementById("themeToggle");
const themeMeta = document.querySelector('meta[name="theme-color"]');

function safeStorageGet(key){
  try{
    return localStorage.getItem(key);
  }catch(_){
    return null;
  }
}

function safeStorageSet(key, value){
  try{
    localStorage.setItem(key, value);
  }catch(_){
    // ignore storage errors
  }
}

function applyTheme(theme){
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = nextTheme;

  if(themeToggle){
    themeToggle.setAttribute("aria-pressed", String(nextTheme === "dark"));
    themeToggle.setAttribute(
      "title",
      nextTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"
    );
    const iconSpan = themeToggle.querySelector("span[aria-hidden]");
    if(iconSpan) iconSpan.textContent = nextTheme === "dark" ? "☀️" : "🌙";
  }

  if(themeMeta){
    themeMeta.setAttribute("content", nextTheme === "dark" ? "#0b1020" : "#ffffff");
  }
}

function initTheme(){
  const stored = safeStorageGet(THEME_STORAGE_KEY);
  applyTheme(stored === "dark" ? "dark" : "light");

  themeToggle?.addEventListener("click", ()=>{
    const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const next = current === "dark" ? "light" : "dark";
    safeStorageSet(THEME_STORAGE_KEY, next);
    applyTheme(next);
  });
}

export { initTheme };
