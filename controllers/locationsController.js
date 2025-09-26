import { getAccessToken } from "../middleware/token.js";
// sending cross company true to get data from all companies in d365 as its not working with false data is coming as NULL []

//to get all sites
export const getSites = async (req, res) => {
    try {
        const {company} = req.query;
        const dataAreaId = company || 'USMF';
        const { access_token: accessToken } = await getAccessToken(req);
        const baseUrl = process.env.D365_URL;
        if (!baseUrl) {
            return res.status(500).json({ message: 'D365_BASE_URL is not defined in environment variables' });
        }

        const url = `${baseUrl}data/OperationalSitesV2/?cross-company=true&$filter=dataAreaId eq '${dataAreaId}'`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
        });
        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ message: `Error fetching sites: ${errorText}` });
        }
        const data = await response.json();
        if (data && data.value) {
            return res.status(200).json(data.value);
        } else {
            return res.status(500).json({ message: 'Invalid response structure from D365' });
        }
    } catch (error) {
        console.error('Error fetching sites:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }

}

//to get all warehouses
export const getWarehouses = async (req, res) => {
    try {
        const {company} = req.query;
        const dataAreaId = company || 'USMF';
        const { access_token: accessToken } = await getAccessToken(req);
        const baseUrl = process.env.D365_URL;
        if (!baseUrl) {
            return res.status(500).json({ message: 'D365_BASE_URL is not defined in environment variables' });
        }
        const url = `${baseUrl}data/Warehouses/?cross-company=true&$filter=dataAreaId eq '${dataAreaId}'`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
        });
        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ message: `Error fetching warehouses: ${errorText}` });
        }
        const data = await response.json();
        if (data && data.value) {
            return res.status(200).json(data.value);
        } else {
            return res.status(500).json({ message: 'Invalid response structure from D365' });
        }
    } catch (error) {
        console.error('Error fetching warehouses:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

//to get all currencies 
export const getCurrencies = async (req, res) => {
    try {
        const { access_token: accessToken } = await getAccessToken(req);
        const baseUrl = process.env.D365_URL;
        if (!baseUrl) {
            return res.status(500).json({ message: 'D365_BASE_URL is not defined in environment variables' });
        }
        const url = `${baseUrl}data/Currencies/?cross-company=true`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
        });
        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ message: `Error fetching currencies: ${errorText}` });
        }
        const data = await response.json();
        if (data && data.value) {
            return res.status(200).json(data.value);
        } else {
            return res.status(500).json({ message: 'Invalid response structure from D365' });
        }
    } catch (error) {
        console.error('Error fetching currencies:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}
