const TICK_INTERVAL = 125;  /* msec */
const INPUT_TIMER   = 5999; /* msec */
const IS_TOUCH = "ontouchstart" in window;

function shuffleArray (array) {
  for (var i = array.length - 1; i > 0; i--) {
    var r = Math.floor(Math.random() * (i + 1));
    var tmp = array[i];
    array[i] = array[r];
    array[r] = tmp;
  }
}

const STATES = {
  INTRO: 0,
  READING: 1,
  INPUT: 2,
  CORRECT: 3,
  ERROR: 4,
  RESULT: 5,
};

const SOUNDS = {
  ANSWER: loadAudio("./assets/answer.mp3"),
  CORRECT: loadAudio("./assets/correct.mp3"),
  PROBLEM: loadAudio("./assets/problem.mp3"),
  TIMER: loadAudio("./assets/timer.mp3"),
  WRONG: loadAudio("./assets/wrong.mp3"),
  COMPLETED: loadAudio("./assets/completed.mp3"),
  KEY: loadAudio("./assets/key.mp3"),
};

const data = {
  problems: null,
  loadError: false,
  loadingStatus: "問題データを読み込み中 ...",
  /* game */
  state: STATES.INTRO,
  score: 0,
  correctCount: 0,
  history: [],
  /* problem */
  problemId: null,
  scoreDiff: 200,
  displayedProblem: null,
  pendingProblem: null,
  progressBG: null,
  /* input */
  kanaInput: null,
  alphaInput: null,
  pendingKana: null,
  alphaCorrect: null,
  kanaCorrect: null,
  inputTimer: null,
  inputTimerHistory: [],
};

const vm = new Vue({
  el: "#app",
  data,
  mounted: function () {
    setInterval(this.tick, TICK_INTERVAL);
    window.addEventListener("keydown", (e) => vm.keyDown(e.key));
    this.loadProblems();
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
    toShareUrlCorrect: function (problem) {
      return "https://twitter.com/intent/tweet?text=" +
             "「" + problem + "」に正解した！" + location.href;
    },
    toShareUrlWrong: function (problem) {
      return "https://twitter.com/intent/tweet?text=" +
             "「" + problem + "」に正解できなかった😭" + location.href;
    },
  },
  methods: {
    loadProblems: function () {
      const match = location.href.match(/\?(.+)$/);
      const xhr = new XMLHttpRequest();
      xhr.onload = function () {
        if (xhr.responseText.startsWith("作問テンプレートv1.0")) {
          vm.problems = importTsv1(xhr.responseText);
        } else {
          vm.problems = JSON.parse(xhr.responseText);
        }
      };
      xhr.onerror = function () { vm.loadError = true; };
      xhr.open("GET", match ? `https://${match[1]}` : "problems.json", true);
      xhr.send(null);
    },
    monitorLoadingStatus: function () {
      if (this.problems) {
        const audios = Object.values(SOUNDS);
        const loadingAudios = audios.filter((audio) => audio.loading).length;
        if (loadingAudios > 0) {
          this.loadingStatus = `効果音を読み込み中 (残り ${loadingAudios}) ...`;
        } else {
          this.loadingStatus = null;
        }
      }
    },
    initGame: function () {
      if (this.problems.shuffle) {
        shuffleArray(this.problems.problems);
      }
      this.score = 0;
      this.correctCount = 0;
      this.history = [];
      this.initProblem(0);
    },
    initProblem: function (problemId) {
      playAudio(SOUNDS.PROBLEM);
      this.problemId = problemId;
      this.scoreDiff = 200;
      this.progressBG = "linear-gradient(to right,#edad0b 0%,#edad0b 50%,#DA5019 50%)";
      this.displayedProblem = "";
      this.pendingProblem = "問題:  " + this.problems.problems[problemId].body.normalize();
      this.state = STATES.READING;
    },
    revealProblem: function () {
      if (this.pendingProblem) {
        this.displayedProblem = this.displayedProblem + this.pendingProblem[0];
        this.pendingProblem = this.pendingProblem.slice(1);
        const total = this.problems.problems[this.problemId].body.length;
        this.scoreDiff = 100 + Math.round(this.pendingProblem.length / total * 100);
        const p = this.scoreDiff / 2;
        this.progressBG = (
          `linear-gradient(to right,#edad0b 0%,#edad0b 50%,#DA5019 50%,#DA5019 ${p}%,#fff ${p}%)`
        );
      } else {
        this.startInput();
      }
    },
    stopProblem: function () {
      playAudio(SOUNDS.ANSWER);
      const p = this.scoreDiff / 2;
      this.progressBG = `linear-gradient(to right,#edad0b 0%,#edad0b ${p}%,#fff ${p}%)`;
      this.startInput();
    },
    startInput: function () {
      playAudio(SOUNDS.TIMER);
      this.inputTimer = INPUT_TIMER;
      this.inputTimerHistory = [];
      this.kanaInput = this.alphaInput = this.pendingKana = "";
      this.alphaCorrect = this.kanaCorrect = false;
      this.state = STATES.INPUT;
    },
    processInput: function (key) {
      stopAudio(SOUNDS.TIMER);
      playAudio(SOUNDS.KEY);
      this.inputTimerHistory = this.inputTimerHistory.concat(this.inputTimer);
      this.inputTimer = INPUT_TIMER;
      [this.kanaInput, this.pendingKana] = inputRomaji(this.kanaInput, this.pendingKana, key);
      this.alphaInput = this.alphaInput.concat(key);
      this.kanaCorrect = this.problems.problems[this.problemId].answers.some(
        (ans) => ans === vm.kanaInput
      );
      this.alphaCorrect = this.problems.problems[this.problemId].answers.some(
        (ans) => ans === vm.alphaInput
      );
      if (this.kanaCorrect || this.alphaCorrect) {
        this.inputCorrect();
      }
    },
    processBackspace: function () {
      if (this.alphaInput === "") {
        return;
      }
      playAudio(SOUNDS.KEY);
      stopAudio(SOUNDS.TIMER);
      this.alphaInput = this.alphaInput.slice(0, -1);
      [this.kanaInput, this.pendingKana] = batchInputRomaji(this.alphaInput);
      const timeSpent = INPUT_TIMER - this.inputTimer;
      this.inputTimer = (
        Math.max(0, this.inputTimerHistory[this.inputTimerHistory.length - 1] - timeSpent)
      );
      this.inputTimerHistory = this.inputTimerHistory.slice(0, -1);
    },
    inputCountDown: function () {
      this.inputTimer -= TICK_INTERVAL;
      if (this.inputTimer <= 0) {
        this.inputTimer = 0;
        this.inputError();
      }
    },
    inputCorrect: function () {
      playAudio(SOUNDS.CORRECT);
      this.history = this.history.concat([{
        problem: this.displayedProblem + (this.pendingProblem === "" ? "" : "/"),
        correct: true,
      }]);
      this.score += this.scoreDiff;
      this.correctCount += 1;
      this.state = STATES.CORRECT;
    },
    inputError: function () {
      if (this.kanaInput !== "" || this.alphaInput !== "" || this.pendingProblem !== "") {
        playAudio(SOUNDS.WRONG);
      }
      this.history = this.history.concat([{
        problem: this.displayedProblem + (this.pendingProblem === "" ? "" : "/"),
        correct: false,
      }]);
      this.state = STATES.ERROR;
    },
    nextProblem: function () {
      if (this.problemId + 1 < this.problems.problems.length) {
        this.initProblem(this.problemId + 1);
      } else {
        playAudio(SOUNDS.COMPLETED);
        this.state = STATES.RESULT;
      }
    },
    backToIntro: function () {
      this.state = STATES.INTRO;
    },
    keyDown: function (key) {
      if (this.state === STATES.INTRO && !this.loadingStatus && key === " ") {
        this.initGame();
      } else if (this.state === STATES.READING && key === " ") {
        this.stopProblem();
      } else if (this.state === STATES.INPUT) {
        if (key.match(/^[a-z0-9-]$/)) {
          this.processInput(key);
        } else if (key === "Backspace") {
          this.processBackspace();
        }
      } else if ((this.state === STATES.ERROR || this.state === STATES.CORRECT) && key === " ") {
        this.nextProblem();
      } else if (this.state === STATES.RESULT && key === " ") {
        this.backToIntro();
      }
    },
    tick: function () {
      if (this.loadingStatus) {
        this.monitorLoadingStatus();
      } else if (this.state === STATES.READING) {
        this.revealProblem();
      } else if (this.state === STATES.INPUT) {
        this.inputCountDown();
      }
    },
  }
});
