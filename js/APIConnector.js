import CONFIG from '../config.js';

class APIConnector {
    constructor() {
        this.baseUrl = CONFIG.API.BASE_URL;
    }

    getEndpoint() {
        return this.baseUrl;
    }

    async sendRequest(action, data) {
        const url = `${this.baseUrl}/${action}`;
        const body = data;

        console.log(`Making API request to: ${url}`);
        console.log('Request data:', body);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            console.log(`Response status: ${response.status}`);
            console.log(`Response headers:`, response.headers);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`API Error Response: ${errorText}`);
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch (e) {
                    errorData = { error: errorText };
                }
                throw new Error(errorData?.error || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            // Cloudflare Functions のレスポンス構造に対応
            if (result.success && result.data) {
                return result.data;
            }
            return result;
        } catch (error) {
            console.error(`API request failed for action: ${action}`, error);
            throw error;
        }
    }

    async startInterview(candidateName) {
        return this.sendRequest('startInterview', { candidateName });
    }

    async submitResponse(sessionId, response, questionId) {
        return this.sendRequest('submitResponse', { sessionId, response, questionId });
    }

    async uploadRecording(sessionId, recordingBlob, fileName) {
        const url = `${this.baseUrl}/uploadRecording`;
        const formData = new FormData();
        formData.append('sessionId', sessionId);
        formData.append('file', recordingBlob, fileName);

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.error || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            // Cloudflare Functions のレスポンス構造に対応
            if (result.success && result.data) {
                return result.data;
            }
            return result;
        } catch (error) {
            console.error('File upload failed:', error);
            throw error;
        }
    }
}

export default APIConnector;
