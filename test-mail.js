require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const { ClientSecretCredential } = require("@azure/identity");
const { Client } = require("@microsoft/microsoft-graph-client");
const { TokenCredentialAuthenticationProvider } = require("@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials");

async function main() {
    const credential = new ClientSecretCredential(
        process.env.GRAPH_TENANT_ID,
        process.env.GRAPH_CLIENT_ID,
        process.env.GRAPH_CLIENT_SECRET
    );

    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
        scopes: ["https://graph.microsoft.com/.default"],
    });

    const client = Client.initWithMiddleware({ authProvider });

    const message = {
        subject: "Test email from App",
        body: { contentType: "Text", content: "This is a test email." },
        toRecipients: [{ emailAddress: { address: "s.okamatsu@luvir.jp" } }]
    };

    try {
        console.log("Trying to send as s.okamatsu@luvir.jp...");
        await client.api("/users/s.okamatsu@luvir.jp/sendMail").post({ message, saveToSentItems: "true" });
        console.log("SUCCESS: s.okamatsu@luvir.jp");
    } catch (e) {
        console.error("FAILED s.okamatsu@luvir.jp:", e.message);
    }

    try {
        console.log("Trying to send as scheduler@luvir.jp...");
        await client.api("/users/scheduler@luvir.jp/sendMail").post({ message, saveToSentItems: "true" });
        console.log("SUCCESS: scheduler@luvir.jp");
    } catch (e) {
        console.error("FAILED scheduler@luvir.jp:", e.message);
    }
}
main();
