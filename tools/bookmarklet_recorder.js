// Bookmarklet version of the recorder
// To use: Create a bookmark with this as the URL, then click it on any page

javascript:(function(){
  if(window.qaaiRecorder) {
    alert('Recorder already active!');
    return;
  }
  
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/gh/your-repo/qa-ai-recorder@main/recorder.js';
  script.onload = function() {
    window.qaaiRecorder.init();
  };
  document.head.appendChild(script);
  
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = 'https://cdn.jsdelivr.net/gh/your-repo/qa-ai-recorder@main/recorder.css';
  document.head.appendChild(style);
})();

// Standalone version (paste in browser console)
(function() {
  'use strict';
  
  // Recorder code here (same as browser_recorder.html but as a script)
  // This allows injection into any page via console
  
  console.log('QA AI Recorder loaded. Use window.qaaiRecorder.start() to begin.');
})();



