const { default: axios } = require("axios");
const https = require("https");
const fs = require("fs");
const express = require("express");
const app = express();
const port = 3003;
const qs = require("qs");

const SMD_AUTH_BASE_URL = `https://sharemydataqa.pge.com/myAuthorization/`;
const PGE_API_BASE_URL = `https://apiqa.pge.com`;

const QA_CLIENT_ID = "<SECRET_STRING>";
const QA_CLIENT_SECRET = "<SECRET_STRING>";
const PROD_CLIENT_ID = "<SECRET_STRING>";

const CLIENT_ID = QA_CLIENT_ID;
const CLIENT_SECRET = QA_CLIENT_SECRET;

const today = new Date();
const twoDaysAgo = new Date(today).setDate(today.getDate() - 2);
const oneYearAgo = new Date(today).setDate(today.getDate() - 365);

const smdAuthParams = {
  client_id: CLIENT_ID,
  redirect_uri: "https://www.isharefood.com/OAuthCallback",
  response_type: "code",
  login: "guest"
};

const withQuery = (params) => (url) =>
  `${url}${Object.keys(params).length ? "?" : ""}${qs.stringify(params)}`;

const encode64 = (str) => Buffer.from(str, "utf-8").toString("base64");

app.get("/", (req, res) => {
  const url = withQuery(smdAuthParams)(SMD_AUTH_BASE_URL);
  res.redirect(url);
});

app.get("/OAuthCallback", async (req, res, next) => {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Basic ${encode64(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
  };

  const httpsAgent = new https.Agent({
    cert: fs.readFileSync("ssl/certs/isharefood.com/certificate.crt"),
    key: fs.readFileSync("ssl/private/isharefood.com/private.key"),
  });

  const data = {
    grant_type: "authorization_code",
    code: req.query.code,
    redirect_uri: "https://www.isharefood.com/OAuthCallback",
  };

  const result = await axios.post(
    withQuery(data)(`https://apiqa.pge.com/datacustodian/oauth/v2/token`),
    "",
    { httpsAgent, headers }
  );
  res.send(result.data);
});

app.listen(port, (_) => {
  console.log(`App Listening at http://localhost:${port}`);
});
