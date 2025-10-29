var TICK_INTERVAL = 125;  /* msec */
var INPUT_TIMER   = 5999; /* msec */

function shuffleArray (array) {
  for (var i = array.length - 1; i > 0; i--) {
    var r = Math.floor(Math.random() * (i + 1));
    var tmp = array[i];
    array[i] = array[r];
    array[r] = tmp;
  }
}

function loadAudio (path) {
  const audio = new Audio(path);
  audio.preload = "auto";
  return audio;
}

function playSound (audio) {
  audio.currentTime = 0;
  audio.play();
}

function stopSound (audio) {
  audio.pause();
}

var STATES = {
  INTRO: 0,
  READING: 1,
  INPUT: 2,
  CORRECT: 3,
  ERROR: 4,
  RESULT: 5,
};

var SOUNDS = {
  ANSWER: loadAudio("./assets/answer.mp3"),
  CORRECT: loadAudio("./assets/correct.mp3"),
  PROBLEM: loadAudio("./assets/problem.mp3"),
  TIMER: loadAudio("./assets/timer.mp3"),
  WRONG: loadAudio("./assets/wrong.mp3"),
  COMPLETED: loadAudio("./assets/completed.mp3"),
};

var vm = new Vue({
  el: "#app",
  data: {
    /* game */
    state: STATES.INTRO,
    score: 0,
    correctCount: 0,
    history: [],
    scoreDiff: 200,
    problems: null,
    loadError: false,
    /* problem */
    problemId: null,
    displayedProblem: null,
    pendingProblem: null,
    /* input */
    kanaInput: null,
    alphaInput: null,
    pendingInput: null,
    alphaError: null,
    alphaCorrect: null,
    kanaError: null,
    kanaCorrect: null,
    inputTimer: null,
  },
  mounted: function () {
    this.keyListenerObj = function (e) { vm.keyDown(e.key) };
    this.timerObj = setInterval(this.tick, TICK_INTERVAL);
    window.addEventListener('keydown', this.keyListenerObj);
    // ---- load problems.json
    var match = location.href.match(/\?(.+)$/);
    var xhr   = new XMLHttpRequest();
    xhr.onload = function () { vm.problems = JSON.parse(xhr.responseText); };
    xhr.onerror = function () { vm.loadError = true; };
    xhr.open("GET", match ? `https://${match[1]}` : "problems.json", true);
    xhr.send(null);
  },
  computed: {
    shareUrl: function () {
      return "https://twitter.com/intent/tweet?text=" +
             this.problems.title + "で" + this.score + "点を獲得した！" +
             "（正答数" + this.correctCount + "/" + this.problems.problems.length + "）" +
             location.href;
    },
  },
  filters: {
    toShareUrl: function (problem) {
      return "https://twitter.com/intent/tweet?text=" +
             "「" + problem + "」に正解した！" + location.href;
    },
  },
  methods: {
    initGame: function () {
      this.state = STATES.INTRO;
      this.score = 0;
      this.correctCount = 0;
      this.history = [];
    },
    initProblem: function (problemId) {
      playSound(SOUNDS.PROBLEM);
      this.state = STATES.READING;
      this.problemId = problemId;
      this.scoreDiff = 200;
      this.displayedProblem = "";
      this.pendingProblem = "問題:  " + this.problems.problems[problemId].body.normalize();
      this.kanaInput = this.alphaInput = this.pendingInput = "";
      this.alphaError = this.kanaError = this.alphaCorrect = this.kanaCorrect = false;
      this.inputTimer = INPUT_TIMER;
    },
    inputCorrect: function () {
      playSound(SOUNDS.CORRECT);
      this.history = this.history.concat([{
        problem: this.displayedProblem,
        correct: true,
      }]);
      this.score += this.scoreDiff;
      this.correctCount += 1;
      this.state = STATES.CORRECT;
    },
    inputError: function () {
      stopSound(SOUNDS.TIMER);
      if (this.inputTimer > 0 || this.pendingProblem !== "") {
        playSound(SOUNDS.WRONG);
      }
      this.history = this.history.concat([{
        problem: this.displayedProblem,
        correct: false,
      }]);
      this.state = STATES.ERROR;
    },
    keyDown: function (key) {
      if (this.state === STATES.INTRO && key === " " && this.problems) {
        if (this.problems.shuffle) {
          shuffleArray(this.problems.problems);
        }
        this.initProblem(0);
        return;
      }
      if (this.state === STATES.READING && key === " ") {
        playSound(SOUNDS.ANSWER);
        playSound(SOUNDS.TIMER);
        this.displayedProblem += "/";
        this.state = STATES.INPUT;
        return;
      }
      if (this.state === STATES.INPUT) {
        if (!this.kanaError && key.match(/^[a-z-]$/)) {
          stopSound(SOUNDS.TIMER);
          var v = ROMAJI[this.pendingInput.concat(key)];
          for (let i = 1; i <= this.pendingInput.length && !v; i++) {
            v = ROMAJI[this.pendingInput.slice(i).concat(key)];
          }
          if (v) {
            this.kanaInput = this.kanaInput.concat(v[0]);
            this.pendingInput = v[1];
            this.inputTimer = INPUT_TIMER;
            var kanaIsValid = this.problems.problems[this.problemId].answers.some(function (ans) {
              return ans.match("^" + vm.kanaInput);
            });
            if (!kanaIsValid) {
              this.kanaError = true;
            }
            var kanaIsCorrect = this.problems.problems[this.problemId].answers.some(function (ans) {
              return ans === vm.kanaInput;
            });
            if (kanaIsCorrect) {
              this.kanaCorrect = true;
            }
          } else {
            this.pendingInput += key;
            this.kanaError = true;
          }
        }
        if (!this.alphaError && key.match(/^[0-9a-z]$/)) {
          stopSound(SOUNDS.TIMER);
          this.alphaInput = this.alphaInput.concat(key);
          this.inputTimer = INPUT_TIMER;
          var alphaIsValid = this.problems.problems[this.problemId].answers.some(function (ans) {
            return ans.match("^" + vm.alphaInput);
          });
          if (!alphaIsValid) {
            this.alphaError = true;
          }
          var alphaIsCorrect = this.problems.problems[this.problemId].answers.some(function (ans) {
            return ans === vm.alphaInput;
          });
          if (alphaIsCorrect) {
            this.alphaCorrect = true;
          }
        }
        if (this.kanaCorrect || this.alphaCorrect) {
          this.inputCorrect();
        }
        if (this.kanaError && this.alphaError) {
          this.inputError();
        }
        return;
      }
      if ((this.state === STATES.ERROR || this.state === STATES.CORRECT) && key === " ") {
        if (this.problemId + 1 < this.problems.problems.length) {
          this.initProblem(this.problemId + 1);
        } else {
          playSound(SOUNDS.COMPLETED);
          this.state = STATES.RESULT;
        }
        return;
      }
      if (this.state === STATES.RESULT && key === " ") {
        this.initGame();
        return;
      }
    },
    tick: function () {
      if (this.state === STATES.READING) {
        if (this.pendingProblem) {
          this.displayedProblem = this.displayedProblem + this.pendingProblem[0];
          this.pendingProblem = this.pendingProblem.slice(1);
          var total = this.problems.problems[this.problemId].body.length;
          this.scoreDiff = 100 + Math.floor(this.pendingProblem.length / total * 100);
        } else {
          playSound(SOUNDS.TIMER);
          this.state = STATES.INPUT;
        }
        return;
      }
      if (this.state === STATES.INPUT) {
        this.inputTimer -= TICK_INTERVAL;
        if (this.inputTimer <= 0) {
          this.inputTimer = 0;
          this.inputError();
        }
        return;
      }
    }
  }
});
