

;(function () {
  "use strict"

  var API_BASE    = window.NEURODESK_API || "http://localhost:3000"
  var API_TIMEOUT = 4000


  var checkBtn        = document.getElementById("checkStateBtn")
  var resultBox       = document.getElementById("statusResult")
  var eyeResult       = document.getElementById("eyeResult")
  var postureResult   = document.getElementById("postureResult")
  var activityResult  = document.getElementById("activityResult")
  var vitaminReminder = document.getElementById("vitaminReminder")
  var recommendation  = document.getElementById("result")
  var detailsText     = document.getElementById("detailsText")
  var scoreNumber     = document.getElementById("scoreNumber")
  var scoreRing       = document.getElementById("scoreRing")
  var liveIndicator   = document.getElementById("liveIndicator")
  var liveLabel       = document.getElementById("liveLabel")
  var clock           = document.getElementById("clock")
  var lastSync        = document.getElementById("lastSync")

  var RING_CIRCUMFERENCE = 326.7 

  function clamp(value) {
    var n = Number(value)
    if (!isFinite(n)) return 0
    return Math.min(Math.max(n, 0), 100)
  }

  function levelClass(percent, invert) {
    var v = invert ? 100 - percent : percent
    if (v >= 60) return ""
    if (v >= 35) return "level-warning"
    return "level-danger"
  }

  function statusOf(percent, invert) {
    var v = invert ? 100 - percent : percent
    if (v >= 60) return { text: "Good",     cls: "good" }
    if (v >= 35) return { text: "Warning",  cls: "warning" }
    return { text: "Critical", cls: "danger" }
  }

  function setMetric(prefix, percent, invert) {
    var value = clamp(percent)
    var valueEl  = document.getElementById(prefix + "Value")
    var barEl    = document.getElementById(prefix + "Bar")
    var trackEl  = document.getElementById(prefix + "Progressbar")
    var statusEl = document.getElementById(prefix + "Status")

    if (valueEl) valueEl.textContent = String(Math.round(value))
    if (barEl) {
      barEl.style.width = value + "%"
      barEl.classList.remove("level-warning", "level-danger")
      var lvl = levelClass(value, invert)
      if (lvl) barEl.classList.add(lvl)
    }
    if (trackEl) trackEl.setAttribute("aria-valuenow", String(Math.round(value)))
    if (statusEl) {
      var s = statusOf(value, invert)
      statusEl.textContent = s.text
      statusEl.className = "status " + s.cls
    }
  }

  function setScore(score) {
    var value = clamp(score)
    if (scoreNumber) scoreNumber.textContent = String(Math.round(value))
    if (scoreRing) {
      scoreRing.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - value / 100))
      scoreRing.classList.remove("level-warning", "level-danger")
      var lvl = levelClass(value, false)
      if (lvl) scoreRing.classList.add(lvl)
    }
  }

  function setRow(el, text, cls) {
    if (!el) return
    el.textContent = text
    el.className = "result-row " + cls
  }

  function setConnection(online) {
    if (!liveIndicator || !liveLabel) return
    liveIndicator.classList.toggle("offline", !online)
    liveLabel.textContent = online ? "SYSTEM ONLINE" : "SIMULATION MODE"
  }

  function markSynced() {
    if (lastSync) {
      lastSync.textContent = "LAST SYNC: " + new Date().toLocaleTimeString()
    }
  }


  var REC_MESSAGES = {
    FixPosture:    "Fix your posture — sit straight and relax your shoulders.",
    RestEyes:      "Rest your eyes — look away from the screen for 20 seconds.",
    MoveBody:      "Move your body — stand up and stretch for a few minutes.",
    ReduceStress:  "Reduce stress — take slow, deep breaths.",
    IncreaseLight: "Increase the lighting — your workspace is too dark.",
    TakeVitamins:  "Time to take your vitamins.",
    AllGood:       "All systems nominal. Keep up the good work."
  }

  function renderRecommendations(recs) {
    if (!recommendation) return
    if (!Array.isArray(recs) || recs.length === 0) {
      recommendation.textContent = REC_MESSAGES.AllGood
      return
    }
    var messages = recs.map(function (r) {
      return REC_MESSAGES[r] || String(r)
    })
    recommendation.textContent = messages.join(" ")
  }


  function analyzeState(state) {
    var eyeFatigue    = clamp(state.eyeFatigue)
    var postureScore  = clamp(state.postureScore)
    var activityLevel = clamp(state.activityLevel)
    var stressLevel   = clamp(state.stressLevel)

    setMetric("eye",      eyeFatigue,    true)
    setMetric("posture",  postureScore,  false)
    setMetric("activity", activityLevel, false)
    setMetric("stress",   stressLevel,   true)

    if (typeof state.overallScore === "number") {
      setScore(state.overallScore)
    } else {
      setScore((postureScore + (100 - eyeFatigue) + activityLevel + (100 - stressLevel)) / 4)
    }

    if (eyeFatigue > 70) {
      setRow(eyeResult, "EYES ......... tired — take a break", "alert")
    } else {
      setRow(eyeResult, "EYES ......... nominal", "ok")
    }

    if (postureScore < 60) {
      setRow(postureResult, "POSTURE ...... bad — sit straight", "warn")
    } else {
      setRow(postureResult, "POSTURE ...... good", "ok")
    }

    if (activityLevel < 30) {
      setRow(activityResult, "ACTIVITY ..... low — move a little", "warn")
    } else {
      setRow(activityResult, "ACTIVITY ..... normal", "ok")
    }

    if (state.vitaminTime) {
      setRow(vitaminReminder, "VITAMINS ..... time to take them", "warn")
    } else {
      setRow(vitaminReminder, "VITAMINS ..... not needed now", "ok")
    }

    if (resultBox) resultBox.classList.remove("hidden")
    markSynced()
  }


  function simulateState() {
    return {
      eyeFatigue:    Math.floor(Math.random() * 100),
      postureScore:  Math.floor(Math.random() * 100),
      activityLevel: Math.floor(Math.random() * 100),
      stressLevel:   Math.floor(Math.random() * 100),
      vitaminTime:   Math.random() > 0.7
    }
  }

  function fetchLiveState() {
    var controller = new AbortController()
    var timer = setTimeout(function () { controller.abort() }, API_TIMEOUT)

    return fetch(API_BASE + "/api/state", { signal: controller.signal })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status)
        return res.json()
      })
      .then(function (json) {
        if (!json || json.success !== true || !json.data || !json.data.state) {
          throw new Error("Unexpected response shape")
        }
        var s    = json.data.state
        var recs = json.data.recommendations
        return {
          eyeFatigue:      s.eyeFatigue,
          postureScore:    s.postureScore,
          activityLevel:   s.activityLevel,
          stressLevel:     s.stressLevel,
          overallScore:    s.overallScore,
          vitaminTime:     Array.isArray(recs) && recs.indexOf("TakeVitamins") !== -1,
          recommendations: recs
        }
      })
      .finally(function () {
        clearTimeout(timer)
      })
  }

  function runDiagnostic() {
    if (!checkBtn) return
    checkBtn.disabled = true

    fetchLiveState()
      .then(function (state) {
        setConnection(true)
        analyzeState(state)
        renderRecommendations(state.recommendations)
      })
      .catch(function () {
        setConnection(false)
        var state = simulateState()
        analyzeState(state)
        var recs = []
        if (state.postureScore < 60)  recs.push("FixPosture")
        if (state.eyeFatigue > 70)    recs.push("RestEyes")
        if (state.activityLevel < 30) recs.push("MoveBody")
        if (state.vitaminTime)        recs.push("TakeVitamins")
        renderRecommendations(recs)
      })
      .finally(function () {
        checkBtn.disabled = false
      })
  }

  if (checkBtn) {
    checkBtn.addEventListener("click", runDiagnostic)
  }


  var SENSOR_DETAILS = {
    eye:      "Eye fatigue is estimated from blink rate and screen distance. Above 70% means it is time for a 20-20-20 break.",
    posture:  "Posture score comes from the vision detector. Below 60% indicates slouching or leaning too close.",
    activity: "Activity level tracks how often you move. Below 30% means you have been static for too long.",
    stress:   "Stress is inferred from heart-rate variability and typing cadence. Above 75% triggers a break suggestion."
  }

  var cards = document.querySelectorAll(".card[data-sensor]")
  cards.forEach(function (card) {
    function showDetails() {
      var key = card.getAttribute("data-sensor")
      if (detailsText && SENSOR_DETAILS[key]) {
        detailsText.textContent = SENSOR_DETAILS[key]
      }
    }
    card.addEventListener("click", showDetails)
    card.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        showDetails()
      }
    })
  })


  function tickClock() {
    if (!clock) return
    var now = new Date()
    clock.textContent = now.toLocaleTimeString()
    clock.setAttribute("datetime", now.toISOString())
  }

  tickClock()
  setInterval(tickClock, 1000)
})()
