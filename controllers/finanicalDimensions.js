//to get all financial dimensions


import { getAccessToken } from "../middleware/token.js";

export const getFinancialDimensions = async (req, res) => {
    try {
        const { access_token: accessToken } = await getAccessToken(req);
        const baseUrl = process.env.D365_URL;
        if (!baseUrl) {
            return res.status(500).json({ message: 'D365_BASE_URL is not defined in environment variables' });
        }
        const url = `${baseUrl}data/DimensionAttributes`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
        });
        const data = await response.json();
        if (!response.ok) {
            return res.status(response.status).json({ message: data.error.message });
        }
        if (data && data.value) {
            return res.status(200).json(data.value);
        } else {
            return res.status(500).json({ message: 'Invalid response structure from D365' });
        }
        
    } catch (error) {
        console.error('Error fetching financial dimensions:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}
