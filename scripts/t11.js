JSON.stringify({
  title: document.title,
  line1: document.getElementById('dl-line1').textContent,
  fontSize: document.getElementById('dl-line1').style.fontSize,
  wrapClass: document.getElementById('dl-wrap').className,
})
