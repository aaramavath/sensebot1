const DOM = {
    chatbotFs: document.querySelector(".chatbot-fs"),
    chatBody: document.querySelector(".chat-body"),
    messageInput: document.querySelector(".message-input"),
    sendMessageButton: document.querySelector("#send-message"),
    voiceButton: document.querySelector("#voice-button"),
    voiceOverlay: document.querySelector("#voice-overlay"),
    exitVoiceModeButton: document.querySelector("#voiceBtn"),
    rainbowBall: document.querySelector(".rainbow-ball")
};

// Validate DOM elements
Object.entries(DOM).forEach(([key, element]) => {
    if (!element) {
        console.error(`DOM element "${key}" not found.`);
        alert(`Error: Missing "${key}" element. Check HTML structure.`);
    }
});

const chatHistory = []; //AIzaSyAB5h20kTOQnBczfnR9zV4DFfX4OT02SIA
const API_KEY = "AIzaSyBoIrZdgc6uNzUo9CqhX2Io9tN7ekzVj2M";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

// Validate API key
if (!API_KEY) {
    console.warn("Gemini API key not set.");
    alert("Please set a valid Gemini API key from https://aistudio.google.com/app/apikey");
}

// --- Knowledge Base (FAQ/Club) ---
    const knowledgeBase = [
  { q: /stress|anxious|overwhelmed/i, a: "Take a deep breath. Try slowly inhaling for 4 seconds, holding 4, and exhaling 4. Remember, small steps help!" },
  { q: /sleep|insomnia|tired/i, a: "Creating a bedtime routine and limiting screens 1 hour before sleep can improve rest. A short meditation before bed can help too." },
  { q: /focus|concentration|study/i, a: "Try the Pomodoro technique: 25 minutes focused work, 5 minutes break. Small sessions can boost productivity." },
  { q: /calm|relax|peace/i, a: "Guided meditation, gentle stretching, or listening to soft music can help release tension and bring calm." },
  { q: /help|support|advice/i, a: "I’m here to guide you. You can talk to me about what’s on your mind, or try some breathing exercises together." },
  { q: /sad|down|unhappy/i, a: "It’s okay to feel sad sometimes. Try writing your feelings down or talking to someone you trust." },
  { q: /angry|frustrated|mad/i, a: "Take a moment to breathe and step away if needed. Physical activity like walking or stretching can help release tension." },
  { q: /nervous|anxiety|worried/i, a: "Focus on the present moment. Slow, deep breaths or grounding techniques (like naming 5 things you see) can help." },
  { q: /motivation|lazy|procrastinate/i, a: "Break tasks into tiny steps and reward yourself after finishing each one. Starting is often the hardest part!" },
  { q: /panic|overthinking/i, a: "Try grounding yourself: notice your surroundings, feel your feet on the ground, and take slow breaths." }
];

// --- End Knowledge Base ---

const customPrompt = `You are SenseBot, the AI assistant for The Sense Bracelet website. Your goal is to help users manage stress, relax, and answer questions about mental wellness. Give short, supportive, and safe advice. Suggest exercises, breathing techniques, and mindfulness activities. Do not give medical diagnoses.`;

const createMessageElement = (content, ...classes) => {
    const div = document.createElement("div");
    div.classList.add("message", ...classes);
    div.innerHTML = content;
    return div;
};

function getKnowledgeBaseAnswer(message) {
    for (const item of knowledgeBase) {
        if (item.q.test(message)) {
            return item.a;
        }
    }
    return null;
}

const isClubQuestion = (message) => {
    const keywords = [
        "stress", "anxiety", "relax", "sleep", "focus", "calm"
    ];
    return keywords.some(keyword => message.toLowerCase().includes(keyword));
};

const generateBotResponse = async (userMessage) => {
    // 1. Try knowledge base first
    const kbAnswer = getKnowledgeBaseAnswer(userMessage);
    if (kbAnswer) return kbAnswer;

    // 2. Otherwise, use Gemini as fallback
    console.log("Generating response for:", userMessage);
    const isClub = isClubQuestion(userMessage);
    const contents = [];
    if (isClub) {
        contents.push({ role: "user", parts: [{ text: customPrompt }] });
    }
    chatHistory.forEach(({ role, text }) => {
        contents.push({ role: role === "assistant" ? "model" : "user", parts: [{ text }] });
    });
    contents.push({ role: "user", parts: [{ text: userMessage }] });

    const requestOptions = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents })
    };

    try {
        const response = await fetch(API_URL, requestOptions);
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || `HTTP ${response.status}`);
        }
        let responseText = data.candidates[0]?.content.parts[0]?.text.trim();
        if (!responseText) {
            throw new Error("No response text found.");
        }
        responseText = responseText.replace(/\*/g, "").replace(/\n/g, " ");
        if (responseText.length > 100) {
            responseText = responseText.split(".").slice(0, 2).join(".") + ".";
        }
        return responseText;
    } catch (error) {
        console.error("Gemini API error:", error.message);
        return "Something went wrong, but I'm still here to help. Try asking about stress, sleep, or focus.";
    }
};

const scrollToBottom = () => {
    if (DOM.chatBody) {
        DOM.chatBody.scrollTop = DOM.chatBody.scrollHeight;
    }
};

let isVoiceMode = false; // Track voice mode state

const sendMessage = async (e) => {
    e.preventDefault();
    if (!DOM.messageInput) return;
    const userMessage = DOM.messageInput.value.trim();
    if (!userMessage) return;

    const userMessageElement = createMessageElement(`<div class="message-text">${userMessage}</div>`, "user-message");
    DOM.chatBody.appendChild(userMessageElement);
    scrollToBottom();
    chatHistory.push({ role: "user", text: userMessage });
    DOM.messageInput.value = "";

    const botResponse = await generateBotResponse(userMessage);
    chatHistory.push({ role: "assistant", text: botResponse });

    if (isVoiceMode) {
        await playAIResponse(botResponse);
    } else {
        const botMessageElement = createMessageElement(`<div class="message-text">${botResponse}</div>`, "bot-message");
        DOM.chatBody.appendChild(botMessageElement);
        scrollToBottom();
    }
};

if (DOM.messageInput) {
    DOM.messageInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage(e);
        }
    });
}

if (DOM.sendMessageButton) {
    DOM.sendMessageButton.addEventListener("click", sendMessage);
}

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;
let isRecognitionActive = false;
let isBotSpeaking = false;
let audioStream = null;
let hasGreeted = false;
let lastBotResponse = "";
let recognitionTimeout;
let audioContext = null;
let analyser = null;
let dataArray = null;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;
} else {
    console.error("SpeechRecognition API not supported.");
    alert("Speech recognition not supported. Use Chrome or Edge.");
}

function setupAudio(stream) {
    try {
        audioStream = stream;
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        dataArray = new Float32Array(analyser.fftSize);
        const source = audioContext.createMediaStreamSource(stream);
        const gainNode = audioContext.createGain();
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        source.connect(gainNode);
        gainNode.connect(analyser);
        console.log("Audio context set up with reduced gain");
    } catch (error) {
        console.error("Error setting up audio context:", error);
        alert("Failed to set up audio. Check microphone permissions.");
    }
}

function vibrateBall() {
    if (!analyser || !DOM.rainbowBall) return;
    analyser.getFloatTimeDomainData(dataArray);
    const sum = dataArray.reduce((a, b) => a + b * b, 0) / dataArray.length;
    const rms = Math.sqrt(sum);
    const scale = 1 + rms * 1.5;
    const clampedScale = Math.min(1.5, Math.max(1, scale));
    DOM.rainbowBall.style.transform = `scale(${clampedScale})`;
    if (analyser) requestAnimationFrame(vibrateBall);
}

function startRecognition() {
    if (isBotSpeaking) {
        console.log("Not starting recognition: bot is speaking.");
        return;
    }
    clearTimeout(recognitionTimeout);
    recognitionTimeout = setTimeout(() => {
        if (isListening && !isRecognitionActive && !isBotSpeaking && recognition) {
            try {
                recognition.start();
                isRecognitionActive = true;
                console.log("Started speech recognition");
            } catch (e) {
                console.warn("Recognition start failed:", e);
                isRecognitionActive = false;
                setTimeout(startRecognition, 1000);
            }
        }
    }, 50);

    setTimeout(() => {
        if (isRecognitionActive && recognition) {
            recognition.stop();
            isRecognitionActive = false;
            console.log("Recognition timed out after 20s");
            if (isListening && !isBotSpeaking) startRecognition();
        }
    }, 20000);
}

async function playAIResponse(text, isGreeting = false) {
    try {
        if (!window.speechSynthesis) {
            throw new Error("SpeechSynthesis API not supported.");
        }
        isBotSpeaking = true;
        if (!isGreeting) {
            const botMessageElement = createMessageElement(`<div class="message-text">${text}</div>`, "bot-message");
            DOM.chatBody.appendChild(botMessageElement);
            scrollToBottom();
        }
        lastBotResponse = text.toLowerCase();
        if (recognition && isListening && isRecognitionActive) {
            recognition.stop();
            isRecognitionActive = false;
            console.log("Stopped speech recognition during audio playback");
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';

        // Select the best available voice
        let voices = window.speechSynthesis.getVoices();
        let selectedVoice = voices.find(voice =>
            voice.name.includes('Google US English') ||
            voice.name.includes('Samantha') ||
            voice.name.includes('Microsoft Aria')
        ) || voices.find(voice => voice.lang === 'en-US');
        utterance.voice = selectedVoice;
        utterance.pitch = 1.3;
        utterance.rate = 1.08;
        utterance.volume = 1;

        if (!voices.length) {
            const voiceLoadPromise = new Promise(resolve => {
                window.speechSynthesis.onvoiceschanged = () => {
                    voices = window.speechSynthesis.getVoices();
                    selectedVoice = voices.find(voice =>
                        voice.name.includes('Google US English') ||
                        voice.name.includes('Samantha') ||
                        voice.name.includes('Microsoft Aria')
                    ) || voices.find(voice => voice.lang === 'en-US');
                    utterance.voice = selectedVoice;
                    resolve();
                };
            });
            await voiceLoadPromise;
        }

        window.speechSynthesis.speak(utterance);
        if (DOM.rainbowBall) DOM.rainbowBall.style.animation = "pulse-ai 1.5s ease";

        return new Promise((resolve) => {
            utterance.onend = () => {
                isBotSpeaking = false;
                if (DOM.rainbowBall) {
                    DOM.rainbowBall.style.animation = "none";
                    DOM.rainbowBall.style.transform = "scale(1)";
                }
                setTimeout(() => {
                    if (isListening && !isRecognitionActive && !isBotSpeaking) startRecognition();
                    resolve();
                }, 700);
            };
            utterance.onerror = (event) => {
                isBotSpeaking = false;
                console.error("Speech synthesis error:", event.error, event.message);
                if (DOM.rainbowBall) {
                    DOM.rainbowBall.style.animation = "none";
                    DOM.rainbowBall.style.transform = "scale(1)";
                }
                setTimeout(() => {
                    if (isListening && !isRecognitionActive && !isBotSpeaking) startRecognition();
                    resolve();
                }, 700);
            };
        });
    } catch (error) {
        isBotSpeaking = false;
        console.error("Error playing AI response:", error);
        if (DOM.rainbowBall) {
            DOM.rainbowBall.style.animation = "none";
            DOM.rainbowBall.style.transform = "scale(1)";
        }
        setTimeout(() => {
            if (isListening && !isRecognitionActive && !isBotSpeaking) startRecognition();
        }, 700);
        if (!isGreeting) alert("Error generating audio response. Try again.");
    }
}

function pulseBall() {
    if (!DOM.rainbowBall) return;
    DOM.rainbowBall.style.animation = "pulse-ai 1.5s ease";
    setTimeout(() => {
        if (DOM.rainbowBall) DOM.rainbowBall.style.animation = "none";
    }, 1500);
}

async function handleVoiceInput() {
    if (!recognition) {
        alert("Speech recognition not supported.");
        return;
    }
    isListening = true;
    isVoiceMode = true;
    if (DOM.voiceOverlay) DOM.voiceOverlay.classList.remove("hidden");
    if (!hasGreeted) {
    const greetingText = "Hey there! I'm SenseBot, your AI assistant for The Sense Bracelet. How can I help you today?";
    lastBotResponse = greetingText.toLowerCase(); // <-- reset lastBotResponse
    await playAIResponse(greetingText, true);
    hasGreeted = true;
}
    if (!isRecognitionActive && !isBotSpeaking) {
        startRecognition();
    }

    recognition.onstart = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
            if (!stream.getAudioTracks().length) {
                throw new Error("No audio tracks.");
            }
            setupAudio(stream);
            vibrateBall();
        } catch (err) {
            console.error("Mic access error:", err.message);
            alert(`Microphone error: ${err.message}. Allow mic in browser settings.`);
            recognition.stop();
            isListening = false;
            isRecognitionActive = false;
            isVoiceMode = false;
            cleanupAudio();
        }
    };

    recognition.onresult = async (event) => {
        if (isBotSpeaking) {
            console.log("Ignoring transcript because bot is speaking.");
            return;
        }
        const transcript = Array.from(event.results)
            .map(result => result[0].transcript)
            .join("");
        console.log("Recognized speech:", transcript);
        recognition.stop();
        isRecognitionActive = false;
        cleanupAudio();
        if (DOM.rainbowBall) DOM.rainbowBall.style.transform = "scale(1)";
        if (transcript) {
            const lowerTranscript = transcript.toLowerCase();
            if (
                lowerTranscript.includes(lastBotResponse) ||
                lowerTranscript.includes("angeline academy") ||
                lowerTranscript.includes("club connect")
            ) {
                console.log("Filtered bot speech:", transcript);
                if (isListening && !isRecognitionActive && !isBotSpeaking) startRecognition();
                return;
            }
            const userMessageElement = createMessageElement(`<div class="message-text">${transcript}</div>`, "user-message");
            DOM.chatBody.appendChild(userMessageElement);
            scrollToBottom();
            chatHistory.push({ role: "user", text: transcript });
            const response = await generateBotResponse(transcript);
            chatHistory.push({ role: "assistant", text: response });
            await playAIResponse(response);
            pulseBall();
        }
    };

    recognition.onend = () => {
        console.log("Speech recognition ended");
        isRecognitionActive = false;
        if (isListening && !isBotSpeaking) startRecognition();
    };

    recognition.onerror = (event) => {
        console.error("Speech error:", event.error);
        isRecognitionActive = false;
        cleanupAudio();
        if (event.error !== "no-speech") {
            alert(`Speech error: ${event.error}`);
        }
        if (isListening && !isBotSpeaking) startRecognition();
    };
}

function cleanupAudio() {
    try {
        if (audioStream) {
            audioStream.getAudioTracks().forEach(track => track.stop());
            audioStream = null;
        }
        if (audioContext && audioContext.state !== "closed") {
            audioContext.close().catch(err => console.error("Error closing audio context:", err));
            audioContext = null;
            analyser = null;
            dataArray = null;
        }
    } catch (error) {
        console.error("Error cleaning up audio:", error);
    }
}

if (DOM.voiceButton) {
    DOM.voiceButton.addEventListener("click", handleVoiceInput);
}

if (DOM.exitVoiceModeButton) {
    DOM.exitVoiceModeButton.addEventListener("click", () => {
        if (DOM.voiceOverlay) DOM.voiceOverlay.classList.add("hidden");
        if (recognition) recognition.stop();
        isListening = false;
        isRecognitionActive = false;
        isVoiceMode = false;
        cleanupAudio();
        if (DOM.rainbowBall) {
            DOM.rainbowBall.style.animation = "none";
            DOM.rainbowBall.style.transform = "scale(1)";
        }
        lastBotResponse = "";
    });
}

if (document.querySelector("#close-chatbot")) {
    document.querySelector("#close-chatbot").addEventListener("click", () => {
        if (DOM.chatbotFs) DOM.chatbotFs.style.display = "none";
    });
}


// ADDED BY GROK/MS

// --- Status Box for Listening/Speaking ---
const statusBox = document.getElementById("voice-status-box");

function showStatusBox(text) {
    if (statusBox) {
        statusBox.textContent = text;
        statusBox.style.display = "block";
    }
}
function hideStatusBox() {
    if (statusBox) {
        statusBox.style.display = "none";
    }
}

// Hook into recognition and speaking events
if (recognition) {
    const origOnStart = recognition.onstart;
    recognition.onstart = function(...args) {
        showStatusBox("Listening...");
        if (origOnStart) origOnStart.apply(this, args);
    };

    const origOnEnd = recognition.onend;
    recognition.onend = function(...args) {
        hideStatusBox();
        if (origOnEnd) origOnEnd.apply(this, args);
    };
}

const origPlayAIResponse = playAIResponse;
playAIResponse = async function(text, isGreeting = false) {
    showStatusBox("Speaking...");
    try {
        await origPlayAIResponse.apply(this, arguments);
    } finally {
        hideStatusBox();
    }
};
