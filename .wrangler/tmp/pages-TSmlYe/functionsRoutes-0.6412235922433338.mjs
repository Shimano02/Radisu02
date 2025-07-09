import { onRequestGet as __api_startInterview_js_onRequestGet } from "/Users/shi/Desktop/claude/Develop00/functions/api/startInterview.js"
import { onRequestOptions as __api_startInterview_js_onRequestOptions } from "/Users/shi/Desktop/claude/Develop00/functions/api/startInterview.js"
import { onRequestPost as __api_startInterview_js_onRequestPost } from "/Users/shi/Desktop/claude/Develop00/functions/api/startInterview.js"
import { onRequestGet as __api_test_js_onRequestGet } from "/Users/shi/Desktop/claude/Develop00/functions/api/test.js"
import { onRequestPost as __api_test_js_onRequestPost } from "/Users/shi/Desktop/claude/Develop00/functions/api/test.js"
import { onRequest as __api_recordingControl_js_onRequest } from "/Users/shi/Desktop/claude/Develop00/functions/api/recordingControl.js"
import { onRequest as __api_saveResults_js_onRequest } from "/Users/shi/Desktop/claude/Develop00/functions/api/saveResults.js"
import { onRequest as __api_startInterview_js_onRequest } from "/Users/shi/Desktop/claude/Develop00/functions/api/startInterview.js"
import { onRequest as __api_submitResponse_js_onRequest } from "/Users/shi/Desktop/claude/Develop00/functions/api/submitResponse.js"
import { onRequest as __api_test_js_onRequest } from "/Users/shi/Desktop/claude/Develop00/functions/api/test.js"
import { onRequest as __api_uploadRecording_js_onRequest } from "/Users/shi/Desktop/claude/Develop00/functions/api/uploadRecording.js"

export const routes = [
    {
      routePath: "/api/startInterview",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_startInterview_js_onRequestGet],
    },
  {
      routePath: "/api/startInterview",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_startInterview_js_onRequestOptions],
    },
  {
      routePath: "/api/startInterview",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_startInterview_js_onRequestPost],
    },
  {
      routePath: "/api/test",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_test_js_onRequestGet],
    },
  {
      routePath: "/api/test",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_test_js_onRequestPost],
    },
  {
      routePath: "/api/recordingControl",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_recordingControl_js_onRequest],
    },
  {
      routePath: "/api/saveResults",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_saveResults_js_onRequest],
    },
  {
      routePath: "/api/startInterview",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_startInterview_js_onRequest],
    },
  {
      routePath: "/api/submitResponse",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_submitResponse_js_onRequest],
    },
  {
      routePath: "/api/test",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_test_js_onRequest],
    },
  {
      routePath: "/api/uploadRecording",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_uploadRecording_js_onRequest],
    },
  ]