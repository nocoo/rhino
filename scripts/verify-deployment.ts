export {};

const response = await fetch("https://rhino.hexly.ai/api/live", {
	redirect: "manual",
	signal: AbortSignal.timeout(10_000),
});
const redirect = response.headers.get("location");
if (
	response.status !== 302 ||
	!redirect ||
	new URL(redirect).hostname !== "nocoo.cloudflareaccess.com"
) {
	throw new Error("Unauthenticated production API must redirect to the configured Access team");
}
console.log(
	"Access 边界验证完成；受保护页面、D1 readiness 与部署 revision 仍需授权身份的浏览器验收。",
);
