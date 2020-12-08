const fixing = false;
// const fixing = true;

const tmi = require("tmi.js");
const { Translate } = require("@google-cloud/translate").v2;
const projectId = "";
const translate = new Translate({ projectId });
var request = require("request");
var clientId = '';
// Define configuration options
const opts = {
  identity: {
    username: 'traslatig_jwa',
    password: process.env.OAUTH
  },
  channels: process.env.CHANNELS.split(",")
};

// Create a client with our options
const client = new tmi.client(opts);

const express = require('express');
const app = express();

// Glitch expects a web server so we're starting express to take care of that.
// The page shows the same information as the readme and includes the remix button.
app.get("/", function (request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

app.get("/ping", function (request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

app.get("/ping2", function (request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

app.get("/chat", function (request, response) {
  console.log(request.body);
});

var translatingChannel = new Object;
var delayedChannel = new Object;
var successiveLang = new Object;
var noticedChannel = new Object;

var noticeLanguage = {};
var notice = {
  "es" : "Si escribe con un significado conciso y claro en el orden y la gramática correctos, el resultado de la traducción será mejor.",
  "en" : "If you write in concise and clear meaning in the correct word order and grammar, the translation result will be better.",
  "ko" : "올바른 단어 순서와 문법으로 간결하고 명확하게 작성해야 번역 결과가 좋아집니다."
};
var recentChange = [
  "모국어 연속 60회 → 모국어 번역 일시중지.",
  "\"!번역 xx\"으로 모국어를 다른 언어로 번역. ex) !번역 en",
  "\"!aa bb\"으로 모국어, 외국어를 각각 다른 언어로 번역. 언어코드 대신 x를 넣으면 해당 언어 번역 생략. ex) !es ko, !x en",
];

var streamerId = {
  '123456789' : 'username'
}

var userId = {
  'username' : '123456789'
}

//korean -> setting, foreign -> setting
var translateSettings = {
  '123456789': ['es', 'ko', 'ko'],
  '234567891': ['', 'ko', 'ko'],
  '345678912': ['', '', 'ko'],
  '456789123' : ['ko', 'es', 'es'],
};

var coolTime = 100;

// Register our event handlers (defined below)

client.on("message", onMessageHandler);
client.on("connected", onConnectedHandler);
client.on("notice", (channel, msgid, message) => {
  console.log("\t\t\t\t\t\t%s[%s] %s",channel, msgid, message);
});
// client.on("hosted", (channel, username, viewers, autohost) => {
//   console.log("\t\t\t\t\t\t%s[%s] hosted viewer=%s, autohost=%s",channel, username, viewers, autohost);
// });

function getTwitchApiOpt(userId) {
  var options = {
      uri: 'https://api.twitch.tv/kraken/streams/' + userId,
      method: 'POST',
      headers: {
          'Accept': 'application/vnd.twitchtv.v5+json',
          'Client-ID': '',
      },
      json:true 
  };
  return options;
}

// client.on("raided", (channel, username, viewers) => {
//   console.log("\t\t\t\t\t\t%s[%s] raided viewers=%s", channel, username, viewers);
// });
// Connect to Twitch:
client.connect();

function onMessageHandler(chatbox, context, msg, self) {
  if (!self && !isBot(context)) {
    
    
    var isBroadcaster = false;
    var isModerator = false;
    
    console.log(streamerId[context["room-id"]] + "(" + translatingChannel[context['room-id']] + ")" + " -> " + context["display-name"] + "(" + context['user-id'] + ")" + " : " + msg);
    msg = msg.trim();

    if (context['badges'] != null) {
      isBroadcaster = context['badges'].hasOwnProperty('broadcaster');
      isModerator = context['badges'].hasOwnProperty('moderator');
    }
    
    if (isMsgNoNeedToConsider(msg, context)) return;

    if (msg != "!번역시작" && msg != "!번역끝" && msg != "!ts" && msg != "!te") {
      if (isBroadcaster || isModerator) {
        if(msg.indexOf("!") == 0) {  
          checkForCommand(chatbox, context, msg);
          return;
        }
      }  
      if (isTranslatingActivated(context) && isCooled(context)) {
        if(isMsgBulling(msg)) {
          client.say(chatbox, "@"+context['display-name']+" TheIlluminati");
        }
        delayedChannel[context['room-id']] = true;
        t(trimFilter(msg), chatbox, context);
      }
    } 
    else if (msg == "!번역시작" || msg == "!ts") {
      if(!fixing) {
        if (isBroadcaster || isModerator) {
          if (isTranslatingActivated(context)) {
            client.say(chatbox, "번역 중입니다.");
          }
          else {
            if (translatingChannel.hasOwnProperty(context['room-id']) == false) translatingChannel[context['room-id']] = 1;
            else translatingChannel[context['room-id']] = translatingChannel[context['room-id']] * -1;
            delayedChannel[context['room-id']] = false;
            successiveLang[context['room-id']] = "";
            if (noticedChannel.hasOwnProperty(context['room-id']) == false) noticedChannel[context['room-id']] = false;
            console.log(context['room-id'] + " translator on");
            client.say(chatbox, "번역을 시작합니다.");
            //displayRecentChanges(chatbox, context);
          }
        }
      }
      else client.say(chatbox, "HumbleLife VoHiYo");
      
    } else if (msg == "!번역끝" || msg == "!te") {
      if (isBroadcaster || isModerator) {
        if (isTranslatingActivated(context)) {
          translatingChannel[context['room-id']] = translatingChannel[context['room-id']] * -1;
          console.log(context['room-id'] + " translator off");
          client.say(chatbox, "번역을 종료합니다.");
        }
        else {
          client.say(chatbox, "번역이 이미 종료되었습니다.");
        }
      }
    }

    noticeTicker(chatbox, context);
  }
}

function onConnectedHandler(addr, port) {
  if(!fixing) preStart();
  else console.log("F I X I N G F I X I N G F I X I N G F I X I N G F I X I N G F I X I N G F I X I N G F I X I N G");
  console.log(`* Connected to ${addr}:${port}`);
}

function checkForCommand(chatbox, context, msg) {
  if(msg.length == 6) {
    if(msg.indexOf("!번역") == 0) {
      if(isSupported(msg.replace("!번역 ",""))) {
        translateSettings[context['room-id']][0] = msg.replace("!번역 ","").toLowerCase();
        client.say(chatbox, "(" + langs[translateSettings[context['room-id']][2]] + " → " + langs[msg.replace("!번역 ","").toLowerCase()] + ")");
        return true;
      }
    }
  }
  if(msg.match(/![a-z][a-z] [a-z][a-z]/g)) {
    if(isSupported(msg.replace("!", "").split(" ")[0].toLowerCase()) && isSupported(msg.replace("!", "").split(" ")[1].toLowerCase())) {
      translateSettings[context['room-id']][0] = msg.replace("!", "").split(" ")[0].toLowerCase();
      translateSettings[context['room-id']][1] = msg.replace("!", "").split(" ")[1].toLowerCase();
      client.say(chatbox, "(" + langs[translateSettings[context['room-id']][2]] + " → " + langs[translateSettings[context['room-id']][0]] + ", Foreign → " + langs[translateSettings[context['room-id']][1]] + ")");
      return true;
    }
  }
  if(msg.match(/!x [a-z][a-z]/g)) {
    if(isSupported(msg.replace("!x ", "").toLowerCase())) {
      translateSettings[context['room-id']][0] = "";
      translateSettings[context['room-id']][1] = msg.replace("!x ", "").toLowerCase();
      client.say(chatbox, "(" + langs[translateSettings[context['room-id']][2]] + " translation X, Foreign → " + langs[translateSettings[context['room-id']][1]] + ")");
      return true;
    }
  }
  if(msg.match(/![a-z][a-z] x/g)) {
    if(isSupported(msg.replace("!", "").replace(" x", "").toLowerCase())) {
      translateSettings[context['room-id']][0] = msg.replace("!", "").replace(" x", "").toLowerCase();
      translateSettings[context['room-id']][1] = "";
      client.say(chatbox, "(" + langs[translateSettings[context['room-id']][2]] + " → " + langs[translateSettings[context['room-id']][0]] + ", Foreign translation X )");
      return true;
    }
  }
  
  return false;
}

function noticeTicker (chatbox, context) {
  if (translatingChannel[context['room-id']] % 60 == 0) {
    if(Object.keys(noticeLanguage).length == 0) {
      noticeLanguage["en"] = 1;  
      for(let roomid in translateSettings) {
        if(roomid == context['room-id']) {
          for(var i in translateSettings[roomid]) {
            if(translateSettings[roomid][i] != '' && !noticeLanguage.hasOwnProperty(translateSettings[roomid][i])) noticeLanguage[translateSettings[roomid][i]] = 1;
          }
        }
      }
      if(translateSettings[context['room-id']][0] == '') {
        if(noticeLanguage.hasOwnProperty('ko')) delete noticeLanguage['ko'];
      }
    }
    else {
      var l;
      for(let ln in noticeLanguage) {
        l = ln;
        client.say(chatbox, notice[ln]);
        break;
      }
      delete noticeLanguage[l];
    }
    translatingChannel[context['room-id']] += 1;
  }
}

async function t(originTxt, chatbox, context) {
  if(originTxt.split(" ").length > 20) {
    delayedChannel[context['room-id']] = false;
    client.say(chatbox, "too long... BibleThump");
    return;
  }
  if (originTxt.replace(/\s/g, '').length > 0) {
    var motherLanguageTranslatingOpt = "";
    var foreignTranslatingOpt = "";
    var motherLanguage = "";
    
    let [detections] = await translate.detect(originTxt);
    var originLanguage;
    detections = Array.isArray(detections) ? detections : [detections];
    detections.forEach(detection => {
      originLanguage = detection.language;
    });
    if(originLanguage != "und") {
      if(successiveLang[context['room-id']].substring(0,2) == translateSettings[context['room-id']][2] 
         && originLanguage == translateSettings[context['room-id']][2]
         && originLanguage == successiveLang[context['room-id']].substring(0,2)
         && parseInt(successiveLang[context['room-id']].substring(2,5)) >= 50) {
        if(parseInt(successiveLang[context['room-id']].substring(2,5)) == 50) client.say(chatbox, "외국어가 감지되면 번역을 재개합니다.");
        cool(context, 0);
      }
      else {
        for(let channel in translatingChannel) {
          if (channel == context['room-id']) {
            motherLanguageTranslatingOpt = translateSettings[channel][0];
            foreignTranslatingOpt = translateSettings[channel][1];
            motherLanguage = translateSettings[channel][2];
          }  
        }
        if (originLanguage == motherLanguage && motherLanguageTranslatingOpt != "") {
          if (originLanguage == "ja" && motherLanguageTranslatingOpt == "ko" || originLanguage == "ko" && motherLanguageTranslatingOpt == "ja") {
            let [translations] = await translate.translate(originTxt, motherLanguageTranslatingOpt);
            let translatedTxt = "/me " + context['display-name'] + " : " + translations;
            client.say(chatbox, translatedTxt).then((data) => {
              translatingChannel[context['room-id']] += 1;
              console.log("\t\x1b[30m" + data + ", tc=" + translatingChannel[context['room-id']] + ", sl=" + successiveLang[context['room-id']]+"\x1b[0m");
            }).catch((err) => {
              console.log(err);
            });
          }
          else {
            let [preTranslations] = await translate.translate(originTxt, "en");
            let [translations] = await translate.translate(preTranslations, motherLanguageTranslatingOpt);
            let translatedTxt = "/me " + context['display-name'] + " : " + translations;
            client.say(chatbox, translatedTxt).then((data) => {
              translatingChannel[context['room-id']] += 1;
              console.log("\t\x1b[30m" + data + ", tc=" + translatingChannel[context['room-id']] + ", sl=" + successiveLang[context['room-id']]+"\x1b[0m");
            }).catch((err) => {
              console.log(err);
            });
          }
        }
        else if (originLanguage != foreignTranslatingOpt && foreignTranslatingOpt != "" && originLanguage != motherLanguage) {
          if (originLanguage == "ja" && foreignTranslatingOpt == "ko" || originLanguage == "ko" && foreignTranslatingOpt == "ja") {
            let [translations] = await translate.translate(originTxt, foreignTranslatingOpt);
            let translatedTxt = "/me " + context['display-name'] + " : " + translations;
            client.say(chatbox, translatedTxt).then((data) => {
              translatingChannel[context['room-id']] += 1;
              console.log("\t\x1b[30m" + data + ", tc=" + translatingChannel[context['room-id']] + ", sl=" + successiveLang[context['room-id']]+"\x1b[0m");
            }).catch((err) => {
              console.log(err);
            });
          }
          else {
            // let [preTranslations] = await translate.translate(originTxt, "en");
            let [translations] = await translate.translate(originTxt, foreignTranslatingOpt);
            let translatedTxt = "/me " + context['display-name'] + " : " + translations;
            client.say(chatbox, translatedTxt).then((data) => {
              translatingChannel[context['room-id']] += 1;
              console.log("\t\x1b[30m" + data + ", tc=" + translatingChannel[context['room-id']] + ", sl=" + successiveLang[context['room-id']]+"\x1b[0m");
            }).catch((err) => {
              console.log(err);
            });
          }
        }
        cool(context, coolTime);
      }
      successiveCheck(context, originLanguage);
      //displayRecentChanges(chatbox, context);
    }
    else {
      cool(context, 0);
    }
  }
  else cool(context, 0);
}

function successiveCheck(context, originLanguage) {
  if(successiveLang[context['room-id']] == "") successiveLang[context['room-id']] = originLanguage + "001";
  else {
    let successiveL = successiveLang[context['room-id']].substring(0,2);
    var successiveCnt = parseInt(successiveLang[context['room-id']].substring(2,5));
    if(successiveL == originLanguage) {
      successiveCnt += 1;
      successiveLang[context['room-id']] = originLanguage + successiveCnt.toString().padStart(3, '0');
    }
    else successiveLang[context['room-id']] = originLanguage + "001";
  }
}

function trimFilter(s) {
  s = s.toLowerCase();
  s = s.replace(/[\u3130-\u318f]+/g, "");    //ㄱ~ㅢ 제거
  s = s.replace(/\b[ja]+\b/g, "");
  s = s.replace(/\b[ha]+\b/g, "");
  s = s.replace(/@\S*/g, "");
  s = s.replace(/🎵/g, "");
  s = s.replace(/🎶/g, "");
  s = s.replace(/(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff])[\ufe0e\ufe0f]?(?:[\u0300-\u036f\ufe20-\ufe23\u20d0-\u20f0]|\ud83c[\udffb-\udfff])?(?:\u200d(?:[^\ud800-\udfff]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff])[\ufe0e\ufe0f]?(?:[\u0300-\u036f\ufe20-\ufe23\u20d0-\u20f0]|\ud83c[\udffb-\udfff])?)*/g, "");
  s = s.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, "");
  s = s.trim();
  if(s.length == 1 && s == "?") s = "";
  return s;
}

function isBot(c) {
  if (c['user-id'] == "19264788" || c['user-id'] == "271411751" || c['user-id'] == "148580412") return true;
  else return false;
}

function isMsgNoNeedToConsider(s, c) {
  if (s.indexOf("http") >= 0) return true;
  if (c['emotes'] != null) return true;
  if (isRepeatingSubstr(s)) return true;
  return false;
}

function isRepeatingSubstr(s) {
  return ((s + s).indexOf(s, 1) != s.length);
}

function isTranslatingActivated(c) {
  if(translatingChannel.hasOwnProperty(c['room-id']) && translatingChannel[c['room-id']] > 0) return true;
  else return false;
}

function isCooled(c) {
  if (delayedChannel.hasOwnProperty(c['room-id']) && delayedChannel[c['room-id']] == false) return true;
  else return false;
}

function cool(context, cooltime) {
  if(cooltime > 0) {
    setTimeout(function(){
      delayedChannel[context['room-id']] = false;
    }, cooltime);
  }
  else delayedChannel[context['room-id']] = false;
}

var langs = {
    'auto': 'Automatic',
    'af': 'Afrikaans',
    'sq': 'Albanian',
    'am': 'Amharic',
    'ar': 'Arabic',
    'hy': 'Armenian',
    'az': 'Azerbaijani',
    'eu': 'Basque',
    'be': 'Belarusian',
    'bn': 'Bengali',
    'bs': 'Bosnian',
    'bg': 'Bulgarian',
    'ca': 'Catalan',
    'ceb': 'Cebuano',
    'ny': 'Chichewa',
    'zh-cn': 'Chinese Simplified',
    'zh-tw': 'Chinese Traditional',
    'co': 'Corsican',
    'hr': 'Croatian',
    'cs': 'Czech',
    'da': 'Danish',
    'nl': 'Dutch',
    'en': 'English',
    'eo': 'Esperanto',
    'et': 'Estonian',
    'tl': 'Filipino',
    'fi': 'Finnish',
    'fr': 'French',
    'fy': 'Frisian',
    'gl': 'Galician',
    'ka': 'Georgian',
    'de': 'German',
    'el': 'Greek',
    'gu': 'Gujarati',
    'ht': 'Haitian Creole',
    'ha': 'Hausa',
    'haw': 'Hawaiian',
    'iw': 'Hebrew',
    'hi': 'Hindi',
    'hmn': 'Hmong',
    'hu': 'Hungarian',
    'is': 'Icelandic',
    'ig': 'Igbo',
    'id': 'Indonesian',
    'ga': 'Irish',
    'it': 'Italian',
    'ja': 'Japanese',
    'jw': 'Javanese',
    'kn': 'Kannada',
    'kk': 'Kazakh',
    'km': 'Khmer',
    'ko': 'Korean',
    'ku': 'Kurdish (Kurmanji)',
    'ky': 'Kyrgyz',
    'lo': 'Lao',
    'la': 'Latin',
    'lv': 'Latvian',
    'lt': 'Lithuanian',
    'lb': 'Luxembourgish',
    'mk': 'Macedonian',
    'mg': 'Malagasy',
    'ms': 'Malay',
    'ml': 'Malayalam',
    'mt': 'Maltese',
    'mi': 'Maori',
    'mr': 'Marathi',
    'mn': 'Mongolian',
    'my': 'Myanmar (Burmese)',
    'ne': 'Nepali',
    'no': 'Norwegian',
    'ps': 'Pashto',
    'fa': 'Persian',
    'pl': 'Polish',
    'pt': 'Portuguese',
    'ma': 'Punjabi',
    'ro': 'Romanian',
    'ru': 'Russian',
    'sm': 'Samoan',
    'gd': 'Scots Gaelic',
    'sr': 'Serbian',
    'st': 'Sesotho',
    'sn': 'Shona',
    'sd': 'Sindhi',
    'si': 'Sinhala',
    'sk': 'Slovak',
    'sl': 'Slovenian',
    'so': 'Somali',
    'es': 'Spanish',
    'su': 'Sundanese',
    'sw': 'Swahili',
    'sv': 'Swedish',
    'tg': 'Tajik',
    'ta': 'Tamil',
    'te': 'Telugu',
    'th': 'Thai',
    'tr': 'Turkish',
    'uk': 'Ukrainian',
    'ur': 'Urdu',
    'uz': 'Uzbek',
    'vi': 'Vietnamese',
    'cy': 'Welsh',
    'xh': 'Xhosa',
    'yi': 'Yiddish',
    'yo': 'Yoruba',
    'zu': 'Zulu'
};

function getCode(desiredLang) {
    if (!desiredLang) return false;
    desiredLang = desiredLang.toLowerCase();

    if (langs[desiredLang]) return desiredLang;

    var keys = Object.keys(langs).filter(function (key) {
        if (typeof langs[key] !== 'string') return false;
        return langs[key].toLowerCase() === desiredLang;
    });

    return keys[0] || false;
}

function isSupported(desiredLang) {
    return Boolean(getCode(desiredLang));
}

function preStart() {
  //const preStartChannel = [userId[''],userId[''],userId['']];
  const preStartChannel = [];
  preStartChannel.forEach(ele => {
    translatingChannel[ele] = 1;
    delayedChannel[ele] = false;
    successiveLang[ele] = "";
    noticedChannel[ele] = false;
  });
}

function displayRecentChanges(chatbox, context) {
  if(noticedChannel.hasOwnProperty(context['room-id']) && noticedChannel[context['room-id']] == false) {
    recentChange.forEach(change => {
      client.say(chatbox, change);
    });
    noticedChannel[context['room-id']] = true;
  }
}
 
