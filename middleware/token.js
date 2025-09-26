import fetch from "node-fetch";
import D365Token from "../model/D365Token.js";

const GLOBAL_OWNER_ID = "service";
const TOKEN_REFRESH_BUFFER = parseInt(process.env.D365_TOKEN_REFRESH_BUFFER_SECONDS || "60", 10);

const resolveOwnerContext = (context) => {
  if (!context) {
    return { ownerId: GLOBAL_OWNER_ID, ownerType: "service" };
  }

  if (context.req?.user) {
    return resolveOwnerContext(context.req.user);
  }

  if (context.request?.user) {
    return resolveOwnerContext(context.request.user);
  }

  if (context.user) {
    return resolveOwnerContext(context.user);
  }

  if (context._id) {
    return { ownerId: context._id.toString(), ownerType: "local" };
  }

  const azureIdentifier = context.id || context.oid || context.sub;
  if (azureIdentifier) {
    return { ownerId: azureIdentifier.toString(), ownerType: "azure" };
  }

  if (typeof context === "string") {
    return { ownerId: context, ownerType: "local" };
  }

  return { ownerId: GLOBAL_OWNER_ID, ownerType: "service" };
};

const parseIntSafe = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const fetchDynamicsAccessToken = async () => {
  const response = await fetch(`https://login.microsoftonline.com/${process.env.tenant_id}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.client_id,
      client_secret: process.env.client_secret,
      resource: process.env.D365_URL,
      grant_type: process.env.grant_type,
    }).toString(),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Failed to obtain access token (${response.status}): ${message}`.trim());
  }

  const data = await response.json();

  if (!data?.access_token || !data?.expires_on) {
    throw new Error("Failed to obtain access token: missing required fields");
  }

  const expiresOn = parseIntSafe(data.expires_on);

  if (!expiresOn) {
    throw new Error("Failed to obtain access token: invalid expires_on value");
  }

  const tokenPayload = {
    access_token: data.access_token,
    token_type: data.token_type,
    resource: data.resource || process.env.D365_URL,
    expires_on: expiresOn,
  };

  const expiresIn = parseIntSafe(data.expires_in ?? data.ext_expires_in);
  if (expiresIn) {
    tokenPayload.expires_in = expiresIn;
  }

  return tokenPayload;
};

const shapeResponse = (doc, nowSeconds) => ({
  access_token: doc.access_token,
  token_type: doc.token_type,
  resource: doc.resource,
  expires_on: doc.expires_on,
  expires_in: doc.expires_in ?? Math.max(doc.expires_on - nowSeconds, 0),
  ownerId: doc.ownerId ?? GLOBAL_OWNER_ID,
  ownerType: doc.ownerType ?? "service",
});

export const getAccessToken = async (context) => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const { ownerId, ownerType } = resolveOwnerContext(context);

  const filter = { ownerId };
  let tokenDoc = await D365Token.findOne(filter).lean();

  if (!tokenDoc && ownerId === GLOBAL_OWNER_ID) {
    const legacyDoc = await D365Token.findOne({ ownerId: { $exists: false } }).lean();
    if (legacyDoc) {
      await D365Token.updateOne({ _id: legacyDoc._id }, { ownerId: GLOBAL_OWNER_ID, ownerType: "service" });
      tokenDoc = { ...legacyDoc, ownerId: GLOBAL_OWNER_ID, ownerType: "service" };
    }
  }

  if (tokenDoc && tokenDoc.expires_on > nowSeconds + TOKEN_REFRESH_BUFFER) {
    return shapeResponse(tokenDoc, nowSeconds);
  }

  const freshToken = await fetchDynamicsAccessToken();
  const tokenToPersist = {
    ...freshToken,
    ownerId,
    ownerType,
  };

  const updatedDoc = await D365Token.findOneAndUpdate(filter, tokenToPersist, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  }).lean();

  if (!updatedDoc) {
    throw new Error("Failed to cache Dynamics token");
  }

  return shapeResponse(updatedDoc, nowSeconds);
};
