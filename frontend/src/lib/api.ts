import type { SearchResponse, SectionDetail, TitleSummary } from "./types";

export const API_BASE_URL =
    process.env.NODE_ENV === "production"
        ? process.env.NEXT_PUBLIC_API_BASE_URL ||
          "https://api.openjuris.org/api"
        : "http://localhost:8000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        cache: "no-store",
        headers: {
            Accept: "application/json",
            ...init?.headers,
        },
        ...init,
    });

    if (!response.ok) {
        const detail = await response.text();
        const error = new Error(detail || `Request failed: ${response.status}`);
        (error as Error & { status?: number }).status = response.status;
        throw error;
    }

    return (await response.json()) as T;
}

/**
 * Format title number with padding (e.g., "5" -> "05", "49" -> "49")
 */
function formatTitleNumberPadded(titleNumber: string | number): string {
    const str = titleNumber.toString();
    const match = str.match(/^(\d+)([a-z]?)$/);
    if (!match) return str;
    const [, digits, suffix] = match;
    return `${digits.padStart(2, "0")}${suffix}`;
}

/**
 * Build title slug from title number (e.g., "5" -> "usc/title-05")
 */
function buildTitleSlug(titleNumber: string | number): string {
    const padded = formatTitleNumberPadded(titleNumber);
    return `usc/title-${padded}`;
}

export function fetchTitleSummaries(): Promise<TitleSummary[]> {
    return request<
        Array<{
            title_number: string;
            heading: string;
            citation: string;
            slug: string;
        }>
    >("/v1/nodes").then((titles) =>
        titles.map((title) => ({
            ...title,
            title_number: parseInt(title.title_number || "0", 10),
        })),
    );
}

export function fetchTitleTree(
    titleNumber: string | number,
): Promise<TitleSummary> {
    const slug = buildTitleSlug(titleNumber);
    return fetchNodeBySlug(slug).then((node) => ({
        title_number: parseInt(node.title_number || "0", 10),
        heading: node.heading || "",
        citation: `${titleNumber} U.S.C.`,
        slug: node.slug,
    }));
}

export function fetchTitleChildren(titleNumber: string | number): Promise<
    Array<{
        slug: string;
        code_type: string;
        identifier: string | null;
        heading: string | null;
    }>
> {
    const slug = buildTitleSlug(titleNumber);
    return fetchNodeBySlug(slug).then((node) =>
        node.children.map((child) => ({
            slug: child.slug,
            code_type: child.code_type,
            identifier: child.identifier,
            heading: child.heading,
        })),
    );
}

export function fetchNodeBySlug(slug: string): Promise<{
    slug: string;
    code_type: string;
    identifier: string | null;
    heading: string | null;
    title_number: string;
    path: Array<{
        slug: string;
        code_type: string;
        identifier: string | null;
        heading: string | null;
    }>;
    children: Array<{
        slug: string;
        code_type: string;
        identifier: string | null;
        heading: string | null;
        section_number: string | null;
    }>;
}> {
    return request(`/v1/nodes/${slug}`);
}

export function fetchSectionDetail(
    titleNumber: string | number,
    sectionNumber: string,
    options?: { asOf?: string },
): Promise<SectionDetail> {
    const params = new URLSearchParams();
    if (options?.asOf) {
        params.set("as_of", options.asOf);
    }
    const query = params.toString();
    const suffix = query ? `?${query}` : "";
    return request<SectionDetail>(
        `/v1/usc/${titleNumber}/${encodeURIComponent(sectionNumber)}${suffix}`,
    );
}

export function searchSections(params: {
    q: string;
    title?: number;
    limit?: number;
    offset?: number;
}): Promise<SearchResponse> {
    const query = new URLSearchParams({ q: params.q });
    if (params.title) {
        query.set("title", String(params.title));
    }
    if (params.limit) {
        query.set("limit", String(params.limit));
    }
    if (params.offset) {
        query.set("offset", String(params.offset));
    }
    return request<SearchResponse>(`/v1/search?${query.toString()}`);
}

// ─── CFR (Code of Federal Regulations) ───────────────────────────────

// Legacy types kept for backward compatibility
export interface CFRTitle {
    number: number;
    name: string;
    latest_amended_on: string | null;
    up_to_date_as_of: string | null;
}

export interface CFRStructureNode {
    type: string;
    identifier: string;
    label: string;
    label_level: string;
    label_description: string;
    reserved: boolean;
    children: CFRStructureNode[];
    descendant_range?: {
        first?: { type: string; identifier: string };
        last?: { type: string; identifier: string };
    };
}

// New CodeNode-based API functions for CFR

export function fetchCFRTitleSummaries(): Promise<TitleSummary[]> {
    return request<TitleSummary[]>("/v1/cfr/titles");
}

export function fetchCFRNodeBySlug(slug: string): Promise<{
    slug: string;
    code_type: string;
    identifier: string | null;
    heading: string | null;
    title_number: string;
    path: Array<{
        slug: string;
        code_type: string;
        identifier: string | null;
        heading: string | null;
    }>;
    children: Array<{
        slug: string;
        code_type: string;
        identifier: string | null;
        heading: string | null;
        section_number: string | null;
    }>;
}> {
    return request(`/v1/nodes/${slug}`);
}

export function fetchCFRSectionDetail(slug: string): Promise<SectionDetail> {
    return request<SectionDetail>(`/v1/cfr/section/${slug}`);
}

export function fetchCFRByTitleSection(
    title: string | number,
    section: string,
): Promise<{
    title: number;
    section: string;
    sectno: string;
    subject: string;
    part_heading: string;
    content_html: string;
    cita: string;
    slug: string | null;
}> {
    return request(
        `/regulations/cfr?title=${encodeURIComponent(String(title))}&section=${encodeURIComponent(section)}`,
    );
}

export function searchCFRSections(params: {
    q: string;
    title?: string;
    limit?: number;
    offset?: number;
}): Promise<SearchResponse> {
    const query = new URLSearchParams({ q: params.q });
    if (params.title) query.set("title", params.title);
    if (params.limit) query.set("limit", String(params.limit));
    if (params.offset) query.set("offset", String(params.offset));
    return request<SearchResponse>(`/v1/cfr/search?${query.toString()}`);
}

// Legacy functions (deprecated, will 404)
export function fetchCFRTitles(): Promise<{ titles: CFRTitle[] }> {
    return request<{ titles: CFRTitle[] }>("/regulations/titles");
}

export function fetchCFRStructure(
    title: number,
    date?: string,
): Promise<CFRStructureNode> {
    const params = new URLSearchParams();
    params.set("title", String(title));
    if (date) params.set("date", date);
    return request<CFRStructureNode>(
        `/regulations/structure?${params.toString()}`,
    );
}

export function fetchCFRContent(params: {
    title: number;
    part?: string;
    section?: string;
    subpart?: string;
    subchapter?: string;
    chapter?: string;
}): Promise<{ content: string; url: string }> {
    const query = new URLSearchParams();
    query.set("title", String(params.title));
    if (params.part) query.set("part", params.part);
    if (params.section) query.set("section", params.section);
    if (params.subpart) query.set("subpart", params.subpart);
    if (params.subchapter) query.set("subchapter", params.subchapter);
    if (params.chapter) query.set("chapter", params.chapter);
    return request<{ content: string; url: string }>(
        `/regulations/content?${query.toString()}`,
    );
}

export function fetchStateStatute(query: string): Promise<{
    title: string;
    section_name: string | null;
    citation: string;
    text: string;
    text_html: string | null;
    source_url: string;
    slug?: string;
}> {
    return request(`/statutes/search?query=${encodeURIComponent(query)}`);
}

// ─── US Constitution ──────────────────────────────────────────────────

export interface ConstitutionChild {
    slug: string;
    node_type: string;
    name: string;
    description: string;
    has_children: boolean;
}

export interface ConstitutionBreadcrumb {
    slug: string;
    name: string;
}

export interface ConstitutionNodeResponse {
    slug: string;
    node_type: string;
    name: string;
    description: string;
    text_html: string | null;
    children: ConstitutionChild[];
    path: ConstitutionBreadcrumb[];
}

export function fetchConstitutionRoot(): Promise<ConstitutionNodeResponse> {
    return request<ConstitutionNodeResponse>("/constitution");
}

export function fetchConstitutionNode(
    slug: string,
): Promise<ConstitutionNodeResponse> {
    return request<ConstitutionNodeResponse>(`/constitution/${slug}`);
}
