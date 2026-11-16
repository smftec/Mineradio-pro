JSON.stringify({
  title: document.title,
  mTitle: document.getElementById('m-title') && document.getElementById('m-title').textContent,
  mArtist: document.getElementById('m-artist') && document.getElementById('m-artist').textContent,
  mFill: document.getElementById('m-fill') && document.getElementById('m-fill').style.width,
})
