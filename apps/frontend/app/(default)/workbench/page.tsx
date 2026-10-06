export default function WorkbenchPage() {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '48px 32px',
      }}
    >
      <header style={{ marginBottom: '40px' }}>
        <p style={{ marginBottom: '8px' }}>Offer急救站</p>

        <h1
          style={{
            fontSize: '36px',
            fontWeight: 700,
            marginBottom: '12px',
          }}
        >
          内部生产工作台
        </h1>

        <p>V0.1 路由壳层。当前页面不读取、不修改任何简历数据。</p>
      </header>

      <section>
        <h2 style={{ fontSize: '24px', marginBottom: '20px' }}>生产流程</h2>
        <ol style={{ lineHeight: 2 }}>
          <li>1. 上传客户简历 —— 待接入</li>
          <li>2. 原始事实核验 —— 待接入</li>
          <li>3. 输入目标岗位 JD —— 待接入</li>
          <li>4. AI 岗位定制 —— 待接入</li>
          <li>5. 人工审核 —— 待接入</li>
          <li>6. 导出交付物 —— 待接入</li>
        </ol>
      </section>

      <hr style={{ margin: '40px 0 24px' }} />
      <p>当前状态：仅验证 Workbench 独立路由与项目编译兼容性。</p>
    </div>
  );
}
