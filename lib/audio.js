const audioContext = new AudioContext();

const loadAudio = (path) => {
  const obj = { loading: true, buffer: null, node: null };

  const req = new XMLHttpRequest();
  req.open("GET", path, true);
  req.responseType = "arraybuffer";
  req.onload = () => {
    audioContext.decodeAudioData(req.response, (buf) => {
      obj.loading = false;
      obj.buffer = buf;
    });
  };
  req.send();

  return obj;
};

const playAudio = (audio) => {
  if (audio.node) {
    audio.node.stop();
  }
  if (audio.buffer) {
    audio.node = new AudioBufferSourceNode(audioContext);
    audio.node.buffer = audio.buffer;
    audio.node.connect(audioContext.destination);
    audio.node.start();
  }
};

const stopAudio = (audio) => {
  if (audio.node) {
    audio.node.stop();
    audio.node = null;
  }
};
