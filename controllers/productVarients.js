import { getAccessToken } from "../middleware/token.js";

export const getProductVarients = async (req, res) => {
    try {
        const { access_token: accessToken } = await getAccessToken(req);
        const baseUrl = process.env.D365_URL;
        if (!baseUrl) {
            return res.status(500).json({ message: 'D365_BASE_URL is not defined in environment variables' });
        }
        const { itemNumber } = req.query;
        let url = `${baseUrl}data/ProductVariantsV2`;

        if (itemNumber) {
            const filter = encodeURIComponent(`ProductMasterNumber eq '${itemNumber}'`);
            url += `?$filter=${filter}`;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
        const data = await response.json();
        res.status(200).json(data);

        if (!response.ok) {
            return res.status(response.status).json({ message: data.error.message });
        }
        if (data && data.value) {
            return res.status(200).json(data.value);
        } else {
            return res.status(500).json({ message: 'Invalid response structure from D365' });
        }

    } catch (error) {
        console.error('Error fetching product variants:', error);
        res.status(500).json({ message: 'Error fetching product variants' });
    }

}
