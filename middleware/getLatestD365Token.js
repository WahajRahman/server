import User from "../model/User.js";
import { getAccessToken } from "./token.js";

export const getLatestD365Token = async (userOrId) => {
  const user = typeof userOrId === "string" ? await User.findById(userOrId) : userOrId;

  if (!user) {
    throw new Error("User not found");
  }

  const tokenData = await getAccessToken(user);

  if (tokenData?.access_token) {
    user.DynamicsToken = tokenData.access_token;
    if (tokenData.expires_on) {
      user.DynamicsTokenExpiredAt = new Date(tokenData.expires_on * 1000);
    }
    await user.save();
  }

  return tokenData;
};
