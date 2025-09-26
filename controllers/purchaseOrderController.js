import { getAccessToken } from "../middleware/token.js";
//date formatting helper
const toIsoDate = (d) => {
    if (!d) return undefined;
    if (/\d{4}-\d{2}-\d{2}T/.test(d)) return d;
    return `${d}T00:00:00Z`;
};

//  to clean null/undefined values from object
const clean = (o, { stripEmptyStrings = true } = {}) =>
    Object.fromEntries(
        Object.entries(o || {}).filter(([, v]) =>
            v !== null && v !== undefined && (stripEmptyStrings ? v !== "" : true)
        )
    );

const dateFields = new Set([
    "AccountingDate",
    "ConfirmedDeliveryDate",
    "ConfirmedShipDate",
    "ConfirmedShippingDate",
    "ExpectedCrossDockingDate",
    "ExpectedStoreAvailableSalesDate",
    "ExpectedStoreReceiptDate",
    "RequestedDeliveryDate",
    "RequestedShipDate",
]);

const coerceNullToEmpty = (value) => (value === null ? "" : value);

const getCanonicalKey = (key = "") => {
    if (key.toLowerCase() === "dataareaid") {
        return "dataAreaId";
    }
    if (!key) {
        return key;
    }
    return key.charAt(0).toUpperCase() + key.slice(1);
};

// to build po header object
const buildPoHeader = (src = {}) => {
    const normalized = {};

    const baseCompany = src.dataAreaId || src.DataAreaId;
    const resolvedCompany = typeof baseCompany === "string" && baseCompany.trim()
        ? baseCompany.trim()
        : "usmf";
    normalized.dataAreaId = resolvedCompany.toUpperCase();

    for (const [rawKey, originalValue] of Object.entries(src)) {
        if (rawKey.toLowerCase() === "dataareaid") {
            continue;
        }

        const canonicalKey = getCanonicalKey(rawKey);
        let value = coerceNullToEmpty(originalValue);

        if (value === undefined) {
            continue;
        }

        if (dateFields.has(canonicalKey) && value) {
            value = toIsoDate(value);
        }

        normalized[canonicalKey] = value;
    }

    if (!normalized.AccountingDate && normalized.RequestedDeliveryDate) {
        normalized.AccountingDate = normalized.RequestedDeliveryDate;
    }

    return clean(normalized, { stripEmptyStrings: false });
};

// to read error body from D365 response as sometimes it's json, sometimes text
const readErrorBody = async (res) => {
    const ct = res.headers.get("content-type") || "";
    try {
        if (ct.includes("application/json")) return await res.json();
        return await res.text();
    } catch {
        return "<unable to read error body>";
    }
};

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

const parsePositiveInt = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// create purchase order
export const createPurchaseOrder = async (req, res) => {
    try {
        const { access_token: token } = await getAccessToken(req);

        const defaultCompany = process.env.D365_COMPANY || "JDOT";
        const d365Base = process.env.D365_URL;
        if (!d365Base) {
            return res.status(500).json({ error: "D365_URL is not configured" });
        }

        const requestBody = { ...req.body };
        if (!requestBody.dataAreaId && !requestBody.DataAreaId) {
            requestBody.dataAreaId = req.query?.company || defaultCompany;
        }

        const payload = buildPoHeader(requestBody);

        if (!payload.CreatedUser || (typeof payload.CreatedUser === "string" && !payload.CreatedUser.trim())) {
            const fallbackUser = req.user?.name || req.user?.email || req.user?.id;
            if (fallbackUser) {
                payload.CreatedUser = fallbackUser;
            }
        }

        const optionalBlankables = [
            "DeliveryModeId",
            "DeliveryTermsId",
            "PaymentTermsName",
            "DeliveryAddressLocationId",
            "DeliveryAddressStreet",
            "DeliveryAddressCity",
            "DeliveryAddressCountryRegionId",
            "DeliveryAddressCountyId",
            "DeliveryAddressZipCode",
            "FormattedDeliveryAddress",
            "DeliveryAddressStateId",
            "DeliveryAddressName",
            "InvoiceAddressStreet",
            "InvoiceAddressCity",
            "InvoiceAddressState",
            "InvoiceAddressCountryRegionId",
            "InvoiceAddressZipCode",
        ];

        for (const key of optionalBlankables) {
            if (!(key in payload)) {
                payload[key] = "";
            }
        }

        if (!("DeliveryAddressLongitude" in payload)) {
            payload.DeliveryAddressLongitude = 0;
        }

        if (!("DefaultReceivingWarehouseId" in payload)) {
            payload.DefaultReceivingWarehouseId = "";
        }

        for (const key of Object.keys(payload)) {
            const value = payload[key];
            if (typeof value === "string") {
                payload[key] = value.trim();
            }
        }

        if (typeof payload.DeliveryAddressLongitude === "string") {
            payload.DeliveryAddressLongitude = payload.DeliveryAddressLongitude === ""
                ? 0
                : Number(payload.DeliveryAddressLongitude);
        }

        if (Number.isNaN(payload.DeliveryAddressLongitude)) {
            payload.DeliveryAddressLongitude = 0;
        }

        if (typeof payload.DeliveryAddressLatitude === "string") {
            payload.DeliveryAddressLatitude = payload.DeliveryAddressLatitude === ""
                ? 0
                : Number(payload.DeliveryAddressLatitude);
        }

        if (Number.isNaN(payload.DeliveryAddressLatitude)) {
            delete payload.DeliveryAddressLatitude;
        }

        const required = [
            "OrderVendorAccountNumber",
            "InvoiceVendorAccountNumber",
            "PurchaseOrderName",
            "RequestedDeliveryDate",
            "CurrencyCode",
            "DefaultReceivingSiteId",
            "CreatedUser",
        ];

        const missing = required.filter((key) => {
            const value = payload[key];
            if (value === undefined || value === null) return true;
            if (typeof value === "string") {
                return value.trim() === "";
            }
            return false;
        });

        if (missing.length) {
            return res.status(400).json({
                error: "Missing required fields for PO header",
                details: { missing, payloadPreview: payload },
            });
        }

        const url = `${d365Base}data/PurchaseOrderHeadersV2`;
        const headerRes = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Accept: "application/json",
                "OData-Version": "4.0",
                "OData-MaxVersion": "4.0",
                Prefer: "return=representation",
            },
            body: JSON.stringify(payload),
        });

        if (!headerRes.ok) {
            const d365Err = await readErrorBody(headerRes);
            console.error("D365 create header failed:", d365Err);
            return res.status(headerRes.status).json({
                error: "Failed to create PO Header",
                d365: d365Err,
            });
        }

        const createdHeader = await headerRes.json();
        const poNumber = createdHeader.PurchaseOrderNumber;
        return res.status(200).json({
            message: "Purchase Order Created",
            data: createdHeader,
            poNumber,
        });
    } catch (err) {
        console.error("Server exception in createPurchaseOrder:", err);
        return res.status(500).json({ error: "Server Error", details: err.message });
    }
};


//deleting po by id 
export const deletePurchaseOrder = async (req, res) => {
    try {
        const { poNumber } = req.params;
        const { company } = req.query;
        const dataAreaId = company || 'USMF';


        if (!poNumber) {
            return res.status(400).json({ error: "Missing Purchase Order Number" });
        }

        const { access_token: token } = await getAccessToken(req);
        const d365Base = process.env.D365_URL;

        if (!d365Base) {
            return res.status(500).json({ error: "D365_URL is not configured" });
        }

        const url = `${d365Base}data/PurchaseOrderHeadersV2(PurchaseOrderNumber='${poNumber}',dataAreaId='${dataAreaId}')?cross-company=true`;

        const deleteRes = await fetch(url, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "OData-Version": "4.0",
                "OData-MaxVersion": "4.0",
            },
        });

        if (!deleteRes.ok) {
            const d365Err = await readErrorBody(deleteRes);
            console.error("D365 delete PO failed:", d365Err);
            return res.status(deleteRes.status).json({
                error: "Failed to delete Purchase Order",
                d365: d365Err,
            });
        }

        return res.status(200).json({ message: "Purchase Order deleted successfully" });
    } catch (err) {
        console.error("Server exception in deletePurchaseOrder:", err);
        return res.status(500).json({ error: "Server Error", details: err.message });
    }
};

//get PO by id 

export const getPurchaseOrderByNumber = async (req, res) => {
    try {
        const { poNumber } = req.params;
        const { company } = req.query;
        const dataAreaId = company || 'USMF';
        if (!poNumber) {
            return res.status(400).json({ error: "Missing Purchase Order Number" });
        }

        const { access_token: token } = await getAccessToken(req);
        const d365Base = process.env.D365_URL;

        const url = `${d365Base}data/PurchaseOrderHeadersV2/?cross-company=true&$filter=PurchaseOrderNumber eq '${poNumber}' and dataAreaId eq '${dataAreaId}'`;

        console.log("Requesting D365 with URL:", url);

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
        });

        const text = await response.text();
        console.log("Raw response from D365:", text);

        const data = JSON.parse(text);

        if (!data || !data.value || data.value.length === 0) {
            return res.status(404).json({ error: "Purchase Order not found" });
        }

        return res.json({ data: data.value[0] });

    } catch (err) {
        console.error("Error fetching PO:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

// to get po's 
export const getPurchaseOrders = async (req, res) => {
    try {
        const { access_token: token } = await getAccessToken(req);
        const { company, page: rawPage, pageSize: rawPageSize, limit: rawLimit } = req.query;
        const dataAreaId = company || 'USMF';

        const pageSize = Math.min(parsePositiveInt(rawPageSize ?? rawLimit, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
        const page = parsePositiveInt(rawPage, 1);
        const skip = (page - 1) * pageSize;

        const d365Base = process.env.D365_URL;

        if (!d365Base) {
            return res.status(500).json({ error: "D365_URL is not configured" });
        }

        const params = new URLSearchParams();
        params.set('cross-company', 'true');
        params.set('$filter', `dataAreaId eq '${dataAreaId}'`);
        params.set('$orderby', 'PurchaseOrderNumber');
        params.set('$top', pageSize.toString());
        params.set('$skip', skip.toString());
        params.set('$count', 'true');

        const url = `${d365Base}data/PurchaseOrderHeadersV2?${params.toString()}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
        });

        if (!response.ok) {
            const d365Err = await readErrorBody(response);
            console.error("D365 fetch POs failed:", d365Err);
            return res.status(response.status).json({
                error: "Failed to fetch POs",
                d365: d365Err,
            });
        }

        let data;
        try {
            data = await response.json();
        } catch (parseErr) {
            console.error("Failed to parse D365 PO response:", parseErr);
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
        console.error("Unhandled error in getPurchaseOrders:", err);
        return res.status(500).json({ error: "Server Error", details: err.message });
    }
};

const buildLines = (src) => {
    const baseLines = {
        dataAreaId: src.dataAreaId || "usmf",
        PurchaseOrderNumber: src.PurchaseOrderNumber,
        LineNumber: src.LineNumber || 1,
        OrderedPurchaseQuantity: src.OrderedPurchaseQuantity,
        ItemNumber: src.ItemNumber,
        LineDescription: src.LineDescription,
        RequestedDeliveryDate: toIsoDate(src.RequestedDeliveryDate),
        DeliveryAddressLocationId: src.DeliveryAddressLocationId,
        DeliveryAddressStreet: src.DeliveryAddressStreet,
        DeliveryAddressCity: src.DeliveryAddressCity,
        DeliveryAddressZipCode: src.DeliveryAddressZipCode,
        DeliveryAddressCountyId: src.DeliveryAddressCountyId,
        DeliveryAddressCountryRegionId: src.DeliveryAddressCountryRegionId || "",
        DeliveryAddressCountryRegionISOCode: src.DeliveryAddressCountryRegionISOCode,
        DeliveryAddressName: src.DeliveryAddressName,
        DeliveryAddressDescription: src.DeliveryAddressDescription,
        ReceivingWarehouseId: src.ReceivingWarehouseId,
        ReceivingSiteId: src.ReceivingSiteId,
        PurchasePrice: src.PurchasePrice,
        PurchaseUnitSymbol: src.PurchaseUnitSymbol,
        SalesTaxItemGroupCode: src.SalesTaxItemGroupCode,
        FixedAssetTransactionType: src.FixedAssetTransactionType || "Acquisition",
        CalculateLineAmount: src.CalculateLineAmount || "Yes",
        IsDeliveryAddressPrivate: src.IsDeliveryAddressPrivate || "No",
        IsDeliveryAddressOrderSpecific: src.IsDeliveryAddressOrderSpecific || "No",
        ConfirmedDeliveryDate: toIsoDate(src.ConfirmedDeliveryDate),
        ConfirmedShippingDate: toIsoDate(src.ConfirmedShippingDate),
        RequestedShippingDate: toIsoDate(src.RequestedShippingDate),
        LineAmount: src.LineAmount,
        FormattedDelveryAddress: src.FormattedDelveryAddress || src.FormattedDeliveryAddress,
    };
    return clean(baseLines);
};
// create purchase order lines
export const createPurchaseOrderLines = async (req, res) => {
    try {
        const { access_token: token } = await getAccessToken(req);
        const company = process.env.D365_COMPANY || "usmf";
        const d365Base = process.env.D365_URL;
        if (!d365Base) {
            return res.status(500).json({ error: "D365_URL is not configured" });
        }
        const lines = buildLines({ ...req.body, dataAreaId: company });
        const required = [
            "PurchaseOrderNumber",
            "LineNumber",
            "OrderedPurchaseQuantity",
            "ItemNumber",
            "LineDescription",
            "RequestedDeliveryDate",
            "ReceivingWarehouseId",
            "ReceivingSiteId",
            "PurchasePrice",
            "PurchaseUnitSymbol",
            "LineAmount",
        ];
        const missing = required.filter((k) => !lines[k]);
        if (missing.length) {
            return res.status(400).json({
                error: "Missing required fields for PO lines",
                details: { missing, payloadPreview: lines },
            });
        }
        const url = `${d365Base}data/PurchaseOrderLinesV2`;
        const lineRes = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Accept: "application/json",
                "OData-Version": "4.0",
                "OData-MaxVersion": "4.0",
                Prefer: "return=representation",
            },
            body: JSON.stringify(lines),
        });
        if (!lineRes.ok) {
            const err = await lineRes.json();
            const d365Err = await readErrorBody(lineRes);
            console.error("D365 create lines failed:", d365Err);
            console.error("Lines payload:", JSON.stringify(lines, null, 2));
            return res.status(lineRes.status).json({
                error: "Failed to create PO Lines",
                d365: d365Err,
                details: err,
            });
        }

        const createdLines = await lineRes.json();
        return res.status(200).json({ message: "PO Lines Created", data: createdLines });

    } catch (error) {
        console.error("Server exception in createPurchaseOrderLines:", error);
        return res.status(500).json({ error: "Server Error", details: error.message });
    }
};


export const createMutiplePurchaseOrderLines = async (req, res) => {
    try {
        const { access_token: token } = await getAccessToken(req);
        const baseUrl = process.env.D365_URL;
        const { company } = req.query;
        const dataAreaId = company || "USMF";

        if (!baseUrl) {
            return res.status(500).json({ error: "D365_URL is not configured" });
        }

        const acceptLines = Array.isArray(req.body) ? req.body : [req.body];
        const linesPayload = acceptLines.map((line, idx) =>
            buildLines({ ...line, dataAreaId })
        );

        const required = [
            "PurchaseOrderNumber",
            "LineNumber",
            "OrderedPurchaseQuantity",
            "ItemNumber",
            "LineDescription",
            "RequestedDeliveryDate",
            "ReceivingWarehouseId",
            "ReceivingSiteId",
            "PurchasePrice",
            "PurchaseUnitSymbol",
            "LineAmount",
        ];

        const missingErrors = linesPayload
            .map((line, idx) => {
                const missing = required.filter((k) => !line[k]);
                return missing.length ? { line: idx + 1, missing, preview: line } : null;
            })
            .filter(Boolean);

        if (missingErrors.length > 0) {
            return res.status(400).json({
                error: "Missing required fields in one or more lines",
                details: missingErrors,
            });
        }

        const batchId = "batch_" + Date.now();
        const changesetId = "changeset_" + Date.now();

        let batchBody = `--${batchId}\nContent-Type: multipart/mixed; boundary=${changesetId}\n\n`;

        linesPayload.forEach((line, idx) => {
            batchBody += `--${changesetId}\n`;
            batchBody += `Content-Type: application/http\n`;
            batchBody += `Content-Transfer-Encoding: binary\n`;
            batchBody += `Content-ID: ${idx + 1}\n\n`;
            batchBody += `POST ${baseUrl}data/PurchaseOrderLinesV2 HTTP/1.1\n`;
            batchBody += `Content-Type: application/json\n\n`;
            batchBody += `${JSON.stringify(line)}\n\n`;
        });

        batchBody += `--${changesetId}--\n`;
        batchBody += `--${batchId}--`;

        const response = await fetch(`${baseUrl}data/$batch`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": `multipart/mixed;boundary=${batchId}`,
                Accept: "application/json",
            },
            body: batchBody,
        });

        const text = await response.text();

        if (!response.ok) {
            return res
                .status(response.status)
                .json({ error: "Batch request failed", details: text });
        }

        return res.status(200).json({
            message: `Batch processed ${linesPayload.length} line(s)`,
            rawResponse: text,
        });
    } catch (error) {
        console.error("Unhandled error in createMutiplePurchaseOrderLines:", error);
        return res
            .status(500)
            .json({ error: "Server Error", details: error.message });
    }
};

// to get po's lines
export const getPurchaseOrderLines = async (req, res) => {
    try {
        const { access_token: token } = await getAccessToken(req);
        const { company } = req.query;
        const dataAreaId = company || 'USMF';
        const d365Base = process.env.D365_URL;

        if (!d365Base) {
            return res.status(500).json({ error: "D365_URL is not configured" });
        }

        const { poNumber } = req.params;

        if (!poNumber) {
            return res.status(400).json({ error: "Missing Purchase Order Number" });
        }

        const encodedPONumber = encodeURIComponent(`'${poNumber}'`);
        // const url = `${d365Base}data/PurchaseOrderLinesV2/?cross-company=true&$filter=PurchaseOrderNumber eq ${encodedPONumber}`;
        const url = `${d365Base}data/PurchaseOrderLinesV2/?cross-company=true&$filter=dataAreaId eq '${dataAreaId}' and PurchaseOrderNumber eq ${encodedPONumber}`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
        });

        if (!response.ok) {
            const d365Err = await readErrorBody(response);
            console.error("D365 fetch PO Lines failed:", d365Err);
            return res.status(response.status).json({
                error: "Failed to fetch Purchase Order Lines",
                d365: d365Err,
            });
        }

        const data = await response.json();

        return res.status(200).json({
            message: `Purchase Order Lines fetched for PO: ${poNumber}`,
            data: data.value,
            count: data.value.length,
        });
    } catch (err) {
        console.error("Unhandled error in getPurchaseOrderLines:", err);
        return res.status(500).json({ error: "Server Error", details: err.message });
    }
};

//editing the po


export const editPurchaseOrderHeader = async (req, res) => {
    try {
        const { access_token: token } = await getAccessToken(req);

        const { poNumber } = req.params;
        const { company } = req.query;
        const dataAreaId = company || process.env.D365_COMPANY || 'usmf';
        const d365Base = process.env.D365_URL;

        if (!poNumber) {
            return res.status(400).json({ error: 'Missing PurchaseOrderNumber' });
        }

        if (!d365Base) {
            return res.status(500).json({ error: 'D365_URL is not configured' });
        }

    
        const payload = clean({ ...req.body });

       
        const dateFields = [
            'RequestedDeliveryDate',
            'ConfirmedDeliveryDate',
            'ConfirmedShipDate',
            'RequestedShipDate',
            'ExpectedStoreAvailableSalesDate',
            'ExpectedCrossDockingDate',
            'ExpectedStoreReceiptDate',
            'FixedDueDate',
            'AccountingDate'
        ];

        for (const field of dateFields) {
            if (payload[field]) {
                payload[field] = toIsoDate(payload[field]);
            }
        }

        delete payload.PurchaseOrderNumber;
        delete payload.dataAreaId;

        const url = `${d365Base}data/PurchaseOrderHeadersV2(PurchaseOrderNumber='${poNumber}',dataAreaId='${dataAreaId}')?cross-company=true`;

        const patchRes = await fetch(url, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'OData-Version': '4.0',
                'OData-MaxVersion': '4.0',
                Prefer: 'return=representation'
            },
            body: JSON.stringify(payload)
        });

        if (!patchRes.ok) {
            const d365Err = await readErrorBody(patchRes);
            console.error('D365 update PO Header failed:', d365Err);
            return res.status(patchRes.status).json({
                error: 'Failed to update PO header',
                d365: d365Err
            });
        }

        let updated = null;

        if (patchRes.status !== 204) {
            try {
                updated = await patchRes.json();
            } catch (e) {
                console.warn("No JSON body returned, possibly 204 No Content");
            }
        }

        return res.status(200).json({
            message: 'Purchase Order header updated successfully',
            data: updated || {}
        });
    } catch (err) {
        console.error('Server exception in editPurchaseOrderHeader:', err);
        return res.status(500).json({ error: 'Server Error', details: err.message });
    }
};

//get all vendors
export const getVendors = async (req, res) => {
    try {
        const { access_token: token } = await getAccessToken(req);
        const { company, page: rawPage, pageSize: rawPageSize, limit: rawLimit } = req.query;
        const dataAreaId = company || 'USMF';

        const pageSize = Math.min(parsePositiveInt(rawPageSize ?? rawLimit, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
        const page = parsePositiveInt(rawPage, 1);
        const skip = (page - 1) * pageSize;

        const d365Base = process.env.D365_URL;
        if (!d365Base) {
            return res.status(500).json({ error: "D365_URL is not configured" });
        }

        const params = new URLSearchParams();
        params.set('cross-company', 'true');
        params.set('$filter', `dataAreaId eq '${dataAreaId}'`);
        params.set('$orderby', 'VendorAccountNumber');
        params.set('$top', pageSize.toString());
        params.set('$skip', skip.toString());
        params.set('$count', 'true');

        const url = `${d365Base}data/VendorsV2?${params.toString()}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
        });

        if (!response.ok) {
            const d365Err = await readErrorBody(response);
            console.error("D365 fetch vendors failed:", d365Err);
            return res.status(response.status).json({
                error: "Failed to fetch vendors",
                d365: d365Err,
            });
        }

        let data;
        try {
            data = await response.json();
        } catch (parseErr) {
            console.error("Failed to parse D365 vendors response:", parseErr);
            return res.status(500).json({ error: "Invalid response from D365" });
        }

        const items = Array.isArray(data?.value) ? data.value : [];
        const totalCount = typeof data?.['@odata.count'] === 'number' ? data['@odata.count'] : undefined;
        const nextLink = data?.['@odata.nextLink'] ?? null;
        const hasMore = Boolean(nextLink) || (typeof totalCount === 'number' && page * pageSize < totalCount);

        return res.status(200).json({
            data: items,
            count: items.length,
            page,
            pageSize,
            ...(typeof totalCount === 'number' ? { totalCount } : {}),
            hasMore,
            nextPage: hasMore ? page + 1 : null,
            nextLink,
        });
    } catch (err) {
        console.error("Unhandled error in getVendors:", err);
        return res.status(500).json({ error: "Server Error", details: err.message });
    }
};



// to edit PO lines
export const editPurchaseOrderLines = async (req, res) => {
    try {
        const { access_token: token } = await getAccessToken(req);

        const { poNumber, lineNumber } = req.params;
        const { company } = req.query;
        const dataAreaId = company || process.env.D365_COMPANY || "usmf";
        const d365Base = process.env.D365_URL;

        if (!poNumber || !lineNumber) {
            return res.status(400).json({ error: "Missing PurchaseOrderNumber or LineNumber" });
        }

        if (!d365Base) {
            return res.status(500).json({ error: "D365_URL is not configured" });
        }

        const payload = clean({ ...req.body });

        const dateFields = [
            "RequestedDeliveryDate",
            "ConfirmedDeliveryDate",
            "ConfirmedShippingDate",
            "RequestedShippingDate"
        ];

        for (const field of dateFields) {
            if (payload[field]) {
                payload[field] = toIsoDate(payload[field]);
            }
        }

        delete payload.PurchaseOrderNumber;
        delete payload.LineNumber;
        delete payload.dataAreaId;

        const url = `${d365Base}data/PurchaseOrderLinesV2(PurchaseOrderNumber='${poNumber}',LineNumber=${lineNumber},dataAreaId='${dataAreaId}')?cross-company=true`;

        const patchRes = await fetch(url, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Accept: "application/json",
                "OData-Version": "4.0",
                "OData-MaxVersion": "4.0",
                Prefer: "return=representation"
            },
            body: JSON.stringify(payload)
        });

        if (!patchRes.ok) {
            const d365Err = await readErrorBody(patchRes);
            console.error("D365 update PO Line failed:", d365Err);
            return res.status(patchRes.status).json({
                error: "Failed to update PO line",
                d365: d365Err
            });
        }

        let updated = null;
        if (patchRes.status !== 204) {
            try {
                updated = await patchRes.json();
            } catch (e) {
                console.warn("No JSON body returned, possibly 204 No Content");
            }
        }

        return res.status(200).json({
            message: "Purchase Order line updated successfully",
            data: updated || {}
        });

    } catch (err) {
        console.error("Server exception in editPurchaseOrderLines:", err);
        return res.status(500).json({ error: "Server Error", details: err.message });
    }
};

