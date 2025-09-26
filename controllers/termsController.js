import { getAccessToken } from "../middleware/token.js";


export const getDeliveryModes = async (req, res) => {
    try {
        const { access_token: accessToken } = await getAccessToken(req);
        const baseUrl = process.env.D365_URL;
        const {company } = req.query;
        const dataAreaId = company || 'USMF';

        if (!baseUrl) {
            return res.status(500).json({ message: 'D365_BASE_URL is not defined in environment variables' });
        }
        const url = `${baseUrl}data/DeliveryModesV2/?cross-company=true&$filter=dataAreaId eq '${dataAreaId}'`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
        });
        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ message: `Error fetching delivery modes: ${errorText}` });
        }
        const data = await response.json();
        if (data && data.value) {
            return res.status(200).json(data.value);
        } else {
            return res.status(500).json({ message: 'Invalid response structure from D365' });
        }
    } catch (error) {
        return res.status(500).json({ message: `Error fetching delivery modes: ${error.message}` });
    }
}

export const getDeliveryTerms = async (req, res) => {
    try {
        const { access_token: accessToken } = await getAccessToken(req);
        const {company} = req.query;
        const dataAreaId = company || 'USMF';
        const baseUrl = process.env.D365_URL;
        if (!baseUrl) {
            return res.status(500).json({ message: 'D365_BASE_URL is not defined in environment variables' });
        }
        const url = `${baseUrl}data/DeliveryTerms/?cross-company=true&$filter=dataAreaId eq '${dataAreaId}'`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
        });
        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ message: `Error fetching delivery terms: ${errorText}` });
        }
        const data = await response.json();
        if (data && data.value) {
            return res.status(200).json(data.value);
        } else {
            return res.status(500).json({ message: 'Invalid response structure from D365' });
        }
    } catch (error) {
        return res.status(500).json({ message: `Error fetching delivery terms: ${error.message}` });
    }
}


export const getPaymentTerms = async (req, res) => {
    try {
        const { access_token: accessToken } = await getAccessToken(req);
        const {company} = req.query;
        const dataAreaId = company || 'USMF';
        const baseUrl = process.env.D365_URL;
        if (!baseUrl) {
            return res.status(500).json({ message: 'D365_BASE_URL is not defined in environment variables' });
        }
        const url = `${baseUrl}data/PaymentTerms/?cross-company=true&$filter=dataAreaId eq '${dataAreaId}'`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
        }); 
        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ message: `Error fetching payment terms: ${errorText}` });
        }
        const data = await response.json();
        if (data && data.value) {
            return res.status(200).json(data.value);
        }
        else {
            return res.status(500).json({ message: 'Invalid response structure from D365' });
        }
    } catch (error) {
        return res.status(500).json({ message: `Error fetching payment terms: ${error.message}` });
    }
}


