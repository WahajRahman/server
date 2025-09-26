import { getAccessToken } from "../middleware/token.js";
//getting all legal entities
export const getCompanies = async (req, res) => {
    try {
        const { access_token: accessToken } = await getAccessToken(req);
        
        const baseUrl = process.env.D365_URL;
        if (!baseUrl) {
            return res.status(500).json({ message: 'D365_BASE_URL is not defined in environment variables' });
        }
         const url = `${baseUrl}data/LegalEntities`;

        // const url = `https://usnconeboxax1aos.uigmts.com/data/LegalEntities`
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
        });
        const data = await response.json();
        console.log(data);
        
        if (!response.ok) {
            return res.status(response.status).json({ message: data.error.message });
        }
        if (data && data.value) {
            return res.status(200).json(data.value);
        } else {
            return res.status(500).json({ message: 'Invalid response structure from D365' });

        }
    } catch (error) {
        console.error('Error fetching companies:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}
