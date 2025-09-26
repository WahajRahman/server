
import { getAccessToken } from "../middleware/token.js";


const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

const parsePositiveInt = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const getTransferOrders = async (req, res) => {
    try {
        const { access_token: accessToken } = await getAccessToken(req);
        const { company, page: rawPage, pageSize: rawPageSize, limit: rawLimit } = req.query;
        const dataAreaId = company || 'JDOT';
        const pageSize = Math.min(parsePositiveInt(rawPageSize ?? rawLimit, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
        const page = parsePositiveInt(rawPage, 1);
        const skip = (page - 1) * pageSize;
        const baseUrl = process.env.D365_URL;
        if (!baseUrl) {
            return res.status(500).json({ message: 'D365_BASE_URL is not defined in environment variables' });
        }

const params = new URLSearchParams();
        params.set('cross-company', 'true');
        params.set('$filter', `dataAreaId eq '${dataAreaId}'`);
        params.set('$orderby', 'TransferOrderNumber desc');
        params.set('$top', pageSize.toString());
        params.set('$skip', skip.toString());
        params.set('$count', 'true');

        const url = `${baseUrl}data/TransferOrderHeaders?${params.toString()}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
        });
        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ message: `Error fetching transfer orders: ${errorText}` });
        }
        let data;
        try {
            data = await response.json();
        } catch (parseErr) {
            console.error("Failed to parse D365 TO response:", parseErr);
            return res.status(500).json({ error: "Invalid response from D365" });
        }

        const items = Array.isArray(data?.value) ? data.value : [];
        const totalCount = typeof data?.['@odata.count'] === "number" ? data['@odata.count'] : undefined;
        const nextLink = data?.['@odata.nextLink'] ?? null;
        const hasMore = Boolean(nextLink) || (typeof totalCount === "number" && page * pageSize < totalCount);

        return res.status(200).json({
            data: items,
            count: items.length,
            page,
            pageSize,
            ...(typeof totalCount === "number" ? { totalCount } : {}),
            hasMore,
            nextPage: hasMore ? page + 1 : null,
            nextLink,
        });
    } catch (err) {
        console.error("Unhandled error in getTransferOrders:", err);
        return res.status(500).json({ error: "Server Error", details: err.message });
    }
};



export const getTransferOrderById = async (req, res) => {
    try {
        const { company } = req.query;
        const dataAreaId = company || 'USMF';
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ message: 'Transfer order ID is required' });
        }
        const { access_token: accessToken } = await getAccessToken(req);
       
       
     const baseUrl = process.env.D365_URL;
        if (!baseUrl) {
            return res.status(500).json({ message: 'D365_BASE_URL is not defined in environment variables' });
        }

        const url = `${baseUrl}data/TransferOrderHeaders/?cross-company=true&$filter=TransferOrderNumber eq '${id}' and dataAreaId eq '${dataAreaId}'`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ message: `Error fetching transfer order: ${errorText}` });
        }

        const data = await response.json();
        if (data && data.value) {
            return res.status(200).json(data.value);
        } else {
            return res.status(500).json({ message: 'Invalid response structure from D365' });
        }
    } catch (error) {
        console.error('Error fetching transfer order:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }

}
