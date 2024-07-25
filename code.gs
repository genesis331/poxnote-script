const properties = PropertiesService.getScriptProperties().getProperties();
const inputFolderId = properties.inputFolderId;
const spreadSheetId = properties.spreadSheetId;
const geminiApiKey = properties.geminiApiKey;
const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`;
const zapierChatEndpoint = properties.zapierChatEndpoint;

const testSummary = "The future of work and sustainable travel were discussed. Automation's impact on job sectors was explored, emphasizing the need for upskilling and reskilling. The feasibility of a universal basic income was briefly considered. For sustainable travel, ideas to reduce environmental impact were brainstormed, including electric vehicles and eco-friendly destinations. The potential of eco-tourism and its benefits were discussed, along with challenges in making sustainable travel accessible. Action items include researching automation's impact on jobs, upskilling resources, eco-friendly travel options, and carbon footprint offsetting.";
const testTasks = [{"task": "Research automation's impact on jobs"}, {"task": "Research upskilling resources"}, {"task": "Research eco-friendly travel options"}, {"task": "Research carbon footprint offsetting"}];

function dev(){
  // console.log(suggestTasks(testSummary));
  // readFromSheet();
  // clearSheet();
  // writeToSheet(testTasks);
  // appSheetSuggestTasks(testSummary);
  // checkDue();
}

function checkDue(){
  const theSpreadsheet = SpreadsheetApp.openById(spreadSheetId)
  var theSheet = theSpreadsheet.getSheetByName("Tracker");
  var dataRange = theSheet.getDataRange();
  var data = dataRange.getValues();
  var today = new Date();
  var todayStr = Utilities.formatDate(today, "GMT+8", "dd/MM/yyyy");
  var dueTasks = [];
  for (var i = 1; i < data.length; i++) {
    if (Utilities.formatDate(data[i][3], "GMT+8", "dd/MM/yyyy") == todayStr && data[i][5] != "Completed") {
      dueTasks.push(data[i]);
    }
  }
  console.log(dueTasks);
  var message = "Due tasks for today: \n";
  for (var i = 0; i < dueTasks.length; i++) {
    message = message + dueTasks[i][0] + " - " + dueTasks[i][6] + "\n";
  }
  if (dueTasks.length == 0) {
    message = "No due tasks for today.";
  }
  return message;
}

function appSheetSuggestTasks(summary){
  const tasks = JSON.parse(suggestTasks(summary));
  clearSheet();
  writeToSheet(tasks);
}

function appSheetGenerateSummary(){
  var d = new Date();
  var title = Utilities.formatDate(d, "GMT+8", "yyyy-MM-dd'T'HH:mm:ss'Z'");
  output = summarizeTexts();
  return {
    "title": "Summary " + title,
    "body": output
  };
}

function appSheetSendToChat(title, body){
  sendToChat(title, body);
}

function writeToSheet(tasks) {
  const theSpreadsheet = SpreadsheetApp.openById(spreadSheetId)
  var theSheet = theSpreadsheet.getSheetByName("Suggestion");
  var startRow = theSheet.getLastRow() + 1;
  for (var i = 0; i < tasks.length; i++) {
    theSheet.getRange(startRow + i, 1).setValue(tasks[i].task);
    theSheet.getRange(startRow + i, 2).setValue(tasks[i].team);
  };
  console.log("write done");
}

function clearSheet(){
  const theSpreadsheet = SpreadsheetApp.openById(spreadSheetId)
  var theSheet = theSpreadsheet.getSheetByName("Suggestion");
  var lastRow = theSheet.getLastRow();
  var lastColumn = theSheet.getLastColumn();
  if (lastRow !== 1) {
    var rangeToClear = theSheet.getRange(2, 1, lastRow - 1, lastColumn);
    rangeToClear.clearContent();
    console.log("cleared");
  }
}

function readFromSheet(){
  const theSpreadsheet = SpreadsheetApp.openById(spreadSheetId)
  var theSheet = theSpreadsheet.getSheetByName("Suggestion");
  var dataRange = theSheet.getDataRange();
  var data = dataRange.getValues();
  console.log(data);
}

function suggestTasks(summary){
  const prompt = `
  Here are the departments in the company: {
    "Penang Frontline": "Frontline of their offline store in Penang (supervisor + sales)",
    "Selangor Frontline": "Frontline of their offline store in Selangor (supervisor + sales)",
    "Online Team": "Online team (supervisor, editor, customer service, packer)",
    "Management": "Management (Boss with all the supervisor, manager and director from each team)",
    "Design Team": "Design team (designer, director)",
    "Marketing Team": "Marketing team (marketing manager and officer from marketing related to content, product, ads design, web design so on)",
    "Production Team": "Production team (director, pic of factory)"
  }

  Suggests a few tasks that can be extracted from here, especially from action items. Then assign relevant team to the tasks, if nobody is relevant, leave blank for team. 
  Using this JSON schema:
  Task = {"task": str, "team": str}
  Return a list[Task]: `
  + summary;
  const output = callGeminiButJSON(prompt);
  return output;
}

function sendToChat(title, body){
  const options = { 
    'method' : 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify({
      "title": title,
      "message": body
    })
  };
  const response = UrlFetchApp.fetch(zapierChatEndpoint, options);
  const data = JSON.parse(response);
  return data;
}

function gatherTexts(){
  var folder = DriveApp.getFolderById(inputFolderId);
  var list = [];
  var files = folder.getFiles();
  var texts = "";
  while (files.hasNext()){
    file = files.next();
    var row = []
    row.push(file.getName(),file.getId(),file.getSize())
    if (file.getName().split('.').pop() == 'txt') {
        list.push(row);
        var txt = file.getBlob().getDataAsString();
        texts = texts + txt;
    }
  }
  console.log(list);
  console.log(texts);
  return texts;
}

function summarizeTexts(){
  const prompt = "Summarize the following texts in one paragraph: " + gatherTexts();
  const output = callGemini(prompt);
  return output;
}

function callGeminiButJSON(prompt, temperature=0){
  const payload = {
    "contents": [
      {
        "parts": [
          {
            "text": prompt
          },
        ]
      }
    ], 
    "generationConfig":  {
      "temperature": temperature,
      "response_mime_type": "application/json"
    },
  };

  const options = { 
    'method' : 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload)
  };

  const response = UrlFetchApp.fetch(geminiEndpoint, options);
  const data = JSON.parse(response);
  const content = data["candidates"][0]["content"]["parts"][0]["text"];
  return content;
}

function callGemini(prompt, temperature=0) {
  const payload = {
    "contents": [
      {
        "parts": [
          {
            "text": prompt
          },
        ]
      }
    ], 
    "generationConfig":  {
      "temperature": temperature,
    },
  };

  const options = { 
    'method' : 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload)
  };

  const response = UrlFetchApp.fetch(geminiEndpoint, options);
  const data = JSON.parse(response);
  const content = data["candidates"][0]["content"]["parts"][0]["text"];
  return content;
}