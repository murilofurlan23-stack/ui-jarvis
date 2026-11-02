/* ============================================================
   J.A.R.V.I.S. - Frontend
   Groq (LLM) + Fish Audio (TTS) + Web Speech API (STT)
   ============================================================ */

// ========== CONFIG ==========
// ATENÇÃO: Em produção no Vercel, use variáveis de ambiente + Serverless Functions.
const CONFIG = {
  GROQ_API_KEY: "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",
  FISH_API_KEY: "sk-fish-4_7ivDxS9CFWb_dpqqjC9KgVj1ukn7004S_kpM19cOc",
  FISH_VOICE_ID: "a5b93aeddcc948c19ea04f0afe9d178c",
  GROQ_MODEL: "llama-3.3-70b-versatile",
  FISH_MODEL: "s2.1-pro-free",
  SYSTEM_PROMPT: `Você é o J.A.R.V.I.S. (Just A Rather Very Intelligent System), a inteligência artificial avançada criada por Tony Stark.
Responda sempre em português brasileiro, de forma educada, precisa, um pouco sarcástica e levemente formal, como no filme Iron Man.
Mantenha respostas relativamente curtas (2-4 frases) a menos que o usuário peça detalhes.
Você tem acesso aos sistemas da Stark Industries e está sempre online e pronto para ajudar.
Nunca diga que é um modelo de linguagem genérico. Você é o J.A.R.V.I.S.`
};

// ========== STATE ==========
let conversationHistory = [
  { role: "system", content: CONFIG.SYSTEM_PROMPT }
];
let isListening = false;
let isSpeaking = false;
let recognition = null;

// ========== DOM ==========
const clockEl = document.getElementById("clock");
const dateEl = document.getElementById("date");
const micBtn = document.getElementById("mic-btn");
const voiceStatus = document.getElementById("voice-status");
const voiceWave = document.querySelector(".voice-wave");
const chatOverlay = document.getElementById("chat-overlay");
const chatMessages = document.getElementById("chat-messages");
const textInput = document.getElementById("text-input");
const sendBtn = document.getElementById("send-btn");
const coreStatus = document.getElementById("core-status");
const coreCircle = document.querySelector(".core-circle");
const notifText = document.getElementById("notif-text");

// ========== CLOCK ==========
function updateClock() {
  const now = new Date();
  const time = now.toLocaleTimeString("pt-BR", { hour12: false });
  const days = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
  const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  const dateStr = `${days[now.getDay()]}, ${String(now.getDate()).padStart(2, "0")} ${months[now.getMonth()]} ${now.getFullYear()}`;
  clockEl.textContent = time;
  dateEl.textContent = dateStr;
}
setInterval(updateClock, 1000);
updateClock();

// ========== SPEECH RECOGNITION (STT) ==========
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    voiceStatus.textContent = "Reconhecimento de voz não suportado neste navegador";
    return null;
  }

  const rec = new SpeechRecognition();
  rec.lang = "pt-BR";
  rec.continuous = false;
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  rec.onstart = () => {
    isListening = true;
    micBtn.classList.add("listening");
    voiceWave.classList.add("active");
    voiceStatus.textContent = "Ouvindo...";
    coreStatus.textContent = "LISTENING";
  };

  rec.onresult = (event) => {
    const transcript = event.results[0][0].transcript.trim();
    if (transcript) {
      voiceStatus.textContent = `"${transcript}"`;
      handleUserMessage(transcript);
    }
  };

  rec.onerror = (event) => {
    console.error("Speech error:", event.error);
    stopListening();
    if (event.error === "no-speech") {
      voiceStatus.textContent = "Nenhuma fala detectada";
    } else if (event.error === "not-allowed") {
      voiceStatus.textContent = "Permissão de microfone negada";
    } else {
      voiceStatus.textContent = "Erro no reconhecimento";
    }
  };

  rec.onend = () => {
    stopListening();
  };

  return rec;
}

function startListening() {
  if (isSpeaking || isListening) return;
  if (!recognition) recognition = initSpeechRecognition();
  if (!recognition) return;

  try {
    recognition.start();
  } catch (e) {
    console.warn(e);
  }
}

function stopListening() {
  isListening = false;
  micBtn.classList.remove("listening");
  voiceWave.classList.remove("active");
  if (!isSpeaking) {
    voiceStatus.textContent = "Aguardando comando...";
    coreStatus.textContent = "ONLINE";
  }
}

// ========== GROQ (LLM) ==========
async function askGroq(userText) {
  conversationHistory.push({ role: "user", content: userText });

  if (conversationHistory.length > 12) {
    conversationHistory = [
      conversationHistory[0],
      ...conversationHistory.slice(-10)
    ];
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${CONFIG.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: CONFIG.GROQ_MODEL,
      messages: conversationHistory,
      temperature: 0.7,
      max_tokens: 400
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content?.trim() || "Desculpe, não consegui processar isso.";
  conversationHistory.push({ role: "assistant", content: reply });
  return reply;
}

// ========== FISH AUDIO (TTS) ==========
async function speakWithFish(text) {
  isSpeaking = true;
  coreCircle.classList.add("speaking");
  coreStatus.textContent = "SPEAKING";
  voiceStatus.textContent = "Falando...";

  try {
    const res = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CONFIG.FISH_API_KEY}`,
        "Content-Type": "application/json",
        "model": CONFIG.FISH_MODEL
      },
      body: JSON.stringify({
        text: text,
        reference_id: CONFIG.FISH_VOICE_ID,
        format: "mp3",
        latency: "balanced",
        normalize: true,
        prosody: {
          speed: 1.0,
          volume: 0
        }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Fish Audio error:", errText);
      fallbackSpeak(text);
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    audio.onended = () => {
      URL.revokeObjectURL(url);
      finishSpeaking();
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      fallbackSpeak(text);
    };

    await audio.play();
  } catch (err) {
    console.error("TTS error:", err);
    fallbackSpeak(text);
  }
}

function fallbackSpeak(text) {
  if ("speechSynthesis" in window) {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "pt-BR";
    utter.rate = 1.05;
    utter.onend = finishSpeaking;
    speechSynthesis.speak(utter);
  } else {
    finishSpeaking();
  }
}

function finishSpeaking() {
  isSpeaking = false;
  coreCircle.classList.remove("speaking");
  coreStatus.textContent = "ONLINE";
  voiceStatus.textContent = "Aguardando comando...";
}

// ========== UI HELPERS ==========
function showChat() {
  chatOverlay.classList.add("visible");
}

function addMessage(text, who) {
  const div = document.createElement("div");
  div.className = `message ${who}`;
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  showChat();
}

function updateNotif(msg) {
  notifText.textContent = msg;
  setTimeout(() => {
    notifText.textContent = "Nenhuma nova mensagem";
  }, 8000);
}

// ========== MAIN HANDLER ==========
async function handleUserMessage(text) {
  if (!text.trim()) return;

  addMessage(text, "user");
  updateNotif("Processando comando...");
  voiceStatus.textContent = "Processando...";
  coreStatus.textContent = "THINKING";

  try {
    const reply = await askGroq(text);
    addMessage(reply, "jarvis");
    updateNotif("Resposta gerada");
    await speakWithFish(reply);
  } catch (err) {
    console.error(err);
    const errorMsg = "Desculpe, ocorreu um erro de comunicação com os sistemas.";
    addMessage(errorMsg, "jarvis");
    voiceStatus.textContent = "Erro de conexão";
    coreStatus.textContent = "ONLINE";
    updateNotif("Falha na comunicação");
  }
}

// ========== EVENTS ==========
micBtn.addEventListener("click", () => {
  if (isListening) {
    if (recognition) recognition.stop();
    stopListening();
  } else {
    startListening();
  }
});

sendBtn.addEventListener("click", () => {
  const text = textInput.value.trim();
  if (text) {
    textInput.value = "";
    handleUserMessage(text);
  }
});

textInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    sendBtn.click();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && document.activeElement !== textInput && !e.repeat) {
    e.preventDefault();
    micBtn.click();
  }
});

// ========== INIT ==========
console.log("%cJ.A.R.V.I.S. ONLINE", "color: #00d4ff; font-size: 16px; font-weight: bold;");
updateNotif("Sistemas inicializados");

setTimeout(async () => {
  const greeting = "Bom dia, senhor. Todos os sistemas estão online e funcionando normalmente. Como posso ajudar?";
  addMessage(greeting, "jarvis");
}, 1200);