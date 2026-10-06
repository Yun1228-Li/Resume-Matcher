'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ResumeUploadDialog } from '@/components/dashboard/resume-upload-dialog';
import type {
  CustomSection,
  ResumeData,
  SectionMeta,
} from '@/components/dashboard/resume-component';
import {
  fetchResume,
  fetchResumeList,
  type ResumeListItem,
} from '@/lib/api/resume';

type LoadState = 'loading' | 'ready' | 'error';

function display(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : '—';
}

function BulletList({ items }: { items?: string[] }) {
  if (!items?.length) return null;

  return (
    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-ink-soft">
      {items.map((item, index) => (
        <li key={`${index}-${item}`}>{item}</li>
      ))}
    </ul>
  );
}

function FactCard({
  title,
  subtitle,
  meta,
  bullets,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  bullets?: string[];
}) {
  return (
    <article className="border border-black bg-white p-4 shadow-sw-default">
      <div className="font-semibold text-ink">{title}</div>
      {subtitle ? <div className="mt-1 text-sm text-ink-soft">{subtitle}</div> : null}
      {meta ? <div className="mt-1 font-mono text-xs text-steel-grey">{meta}</div> : null}
      <BulletList items={bullets} />
    </article>
  );
}

function CustomSectionBlock({
  sectionKey,
  section,
  sectionMeta,
}: {
  sectionKey: string;
  section: CustomSection;
  sectionMeta?: SectionMeta;
}) {
  const heading = sectionMeta?.displayName?.trim() || sectionKey;

  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold text-ink">{heading}</h3>

      {section.sectionType === 'itemList' && section.items?.length ? (
        <div className="grid gap-3">
          {section.items.map((item) => (
            <FactCard
              key={item.id}
              title={display(item.title)}
              subtitle={item.subtitle || item.location || undefined}
              meta={item.years || undefined}
              bullets={item.description}
            />
          ))}
        </div>
      ) : null}

      {section.sectionType === 'stringList' && section.strings?.length ? (
        <div className="flex flex-wrap gap-2">
          {section.strings.map((item) => (
            <span
              key={item}
              className="border border-black bg-white px-3 py-1 font-mono text-xs"
            >
              {item}
            </span>
          ))}
        </div>
      ) : null}

      {section.sectionType === 'text' && section.text?.trim() ? (
        <div className="border border-black bg-white p-4 text-sm leading-6">
          {section.text}
        </div>
      ) : null}
    </section>
  );
}

export default function WorkbenchPage() {
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [master, setMaster] = useState<ResumeListItem | null>(null);
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const loadResumeById = useCallback(async (resumeId: string) => {
    setState('loading');
    setError(null);

    try {
      const rows = await fetchResumeList(true);
      const selected = rows.find((item) => item.resume_id === resumeId);

      if (!selected) {
        throw new Error('没有找到刚上传的简历记录。');
      }

      if (selected.processing_status !== 'ready') {
        throw new Error(`简历解析状态为 ${selected.processing_status}，暂时不能进入事实核验。`);
      }

      const detail = await fetchResume(selected.resume_id);
      if (!detail.processed_resume) {
        throw new Error('简历已经保存，但结构化数据为空。');
      }

      setMaster(selected);
      setResume(detail.processed_resume as ResumeData);
      setState('ready');
    } catch (failure) {
      setMaster(null);
      setResume(null);
      setState('error');
      setError(failure instanceof Error ? failure.message : '读取简历失败。');
    }
  }, []);

  const loadMasterResume = useCallback(async () => {
    setState('loading');
    setError(null);

    try {
      const rows = await fetchResumeList(true);
      const readyMasters = rows.filter(
        (item) => item.is_master && item.processing_status === 'ready'
      );

      const selected =
        readyMasters.find((item) => item.is_default_master) ?? readyMasters[0];

      if (!selected) {
        throw new Error('没有找到可用的主简历。请先上传一份客户简历。');
      }

      await loadResumeById(selected.resume_id);
    } catch (failure) {
      setMaster(null);
      setResume(null);
      setState('error');
      setError(failure instanceof Error ? failure.message : '读取主简历失败。');
    }
  }, [loadResumeById]);

  useEffect(() => {
    void loadMasterResume();
  }, [loadMasterResume]);

  const sectionMetaByKey = useMemo(() => {
    const map = new Map<string, SectionMeta>();
    for (const meta of resume?.sectionMeta ?? []) {
      map.set(meta.key, meta);
    }
    return map;
  }, [resume?.sectionMeta]);

  const customSections = useMemo(
    () => Object.entries(resume?.customSections ?? {}),
    [resume?.customSections]
  );

  const additional = resume?.additional;

  return (
    <div className="min-h-screen w-full bg-[#F6F5EE] px-4 py-8 md:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-8 border border-black bg-white p-6 shadow-sw-lg md:p-8">
          <div className="font-mono text-xs font-bold uppercase tracking-wider text-blue-700">
            Offer急救站 / Workbench
          </div>
          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="font-serif text-3xl font-bold text-ink md:text-4xl">
                原始事实核验
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
                这里只读取 Resume Matcher 已解析的数据，不会修改、增强或覆盖客户简历。
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <ResumeUploadDialog
                open={uploadOpen}
                onOpenChange={setUploadOpen}
                onUploadComplete={(resumeId) => {
                  void loadResumeById(resumeId);
                }}
                trigger={
                  <button
                    type="button"
                    className="border-2 border-black bg-blue-700 px-4 py-2 font-mono text-xs font-bold uppercase text-white shadow-sw-default transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                  >
                    上传客户简历
                  </button>
                }
              />

              <button
                type="button"
                onClick={() => void loadMasterResume()}
                disabled={state === 'loading'}
                className="border-2 border-black bg-white px-4 py-2 font-mono text-xs font-bold uppercase shadow-sw-default transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {state === 'loading' ? '读取中...' : '读取默认主简历'}
              </button>
            </div>
          </div>
        </header>

        {state === 'loading' ? (
          <section
            className="border border-black bg-white p-8 font-mono text-sm shadow-sw-default"
            aria-live="polite"
          >
            正在读取默认主简历...
          </section>
        ) : null}

        {state === 'error' ? (
          <section
            className="border-2 border-red-600 bg-red-50 p-6 text-sm text-red-700 shadow-sw-default"
            aria-live="polite"
          >
            <div className="font-bold">读取失败</div>
            <div className="mt-2">{error}</div>
          </section>
        ) : null}

        {state === 'ready' && resume && master ? (
          <div className="space-y-8">
            <section className="border border-black bg-white p-5 shadow-sw-default">
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <div className="font-mono text-[11px] uppercase text-steel-grey">
                    当前文件
                  </div>
                  <div className="mt-1 break-all text-sm font-semibold text-ink">
                    {master.filename || '未命名简历'}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[11px] uppercase text-steel-grey">
                    Resume ID
                  </div>
                  <div className="mt-1 break-all font-mono text-xs text-ink-soft">
                    {master.resume_id}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[11px] uppercase text-steel-grey">
                    解析状态
                  </div>
                  <div className="mt-1 text-sm font-semibold text-green-700">
                    {master.processing_status}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[11px] uppercase text-steel-grey">
                    主简历
                  </div>
                  <div className="mt-1 text-sm font-semibold text-ink">
                    {master.is_default_master ? '默认主简历' : '主简历'}
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="font-serif text-2xl font-bold text-ink">基本信息</h2>
              <div className="grid gap-3 border border-black bg-white p-5 shadow-sw-default md:grid-cols-2">
                <div><span className="font-semibold">姓名：</span>{display(resume.personalInfo?.name)}</div>
                <div><span className="font-semibold">职位：</span>{display(resume.personalInfo?.title)}</div>
                <div><span className="font-semibold">邮箱：</span>{display(resume.personalInfo?.email)}</div>
                <div><span className="font-semibold">电话：</span>{display(resume.personalInfo?.phone)}</div>
                <div><span className="font-semibold">所在地：</span>{display(resume.personalInfo?.location)}</div>
                <div><span className="font-semibold">个人网站：</span>{display(resume.personalInfo?.website)}</div>
              </div>
            </section>

            {resume.summary?.trim() ? (
              <section className="space-y-3">
                <h2 className="font-serif text-2xl font-bold text-ink">个人简介</h2>
                <div className="border border-black bg-white p-5 text-sm leading-7 shadow-sw-default">
                  {resume.summary}
                </div>
              </section>
            ) : null}

            <section className="space-y-3">
              <h2 className="font-serif text-2xl font-bold text-ink">工作 / 实习经历</h2>
              {resume.workExperience?.length ? (
                <div className="grid gap-3">
                  {resume.workExperience.map((item) => (
                    <FactCard
                      key={item.id}
                      title={display(item.title)}
                      subtitle={[item.company, item.location].filter(Boolean).join(' · ')}
                      meta={item.years}
                      bullets={item.description}
                    />
                  ))}
                </div>
              ) : (
                <div className="border border-dashed border-black p-4 text-sm text-ink-soft">
                  暂无工作 / 实习经历
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="font-serif text-2xl font-bold text-ink">教育经历</h2>
              {resume.education?.length ? (
                <div className="grid gap-3">
                  {resume.education.map((item) => (
                    <FactCard
                      key={item.id}
                      title={display(item.institution)}
                      subtitle={item.degree}
                      meta={item.years}
                      bullets={item.description ? [item.description] : undefined}
                    />
                  ))}
                </div>
              ) : (
                <div className="border border-dashed border-black p-4 text-sm text-ink-soft">
                  暂无教育经历
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="font-serif text-2xl font-bold text-ink">项目经历</h2>
              {resume.personalProjects?.length ? (
                <div className="grid gap-3">
                  {resume.personalProjects.map((item) => (
                    <FactCard
                      key={item.id}
                      title={display(item.name)}
                      subtitle={item.role}
                      meta={item.years}
                      bullets={item.description}
                    />
                  ))}
                </div>
              ) : (
                <div className="border border-dashed border-black p-4 text-sm text-ink-soft">
                  暂无项目经历
                </div>
              )}
            </section>

            {customSections.map(([key, section]) => (
              <CustomSectionBlock
                key={key}
                sectionKey={key}
                section={section}
                sectionMeta={sectionMetaByKey.get(key)}
              />
            ))}

            <section className="space-y-4">
              <h2 className="font-serif text-2xl font-bold text-ink">技能与补充信息</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  ['技术技能', additional?.technicalSkills],
                  ['语言', additional?.languages],
                  ['培训 / 证书', additional?.certificationsTraining],
                  ['荣誉奖项', additional?.awards],
                ].map(([label, values]) => (
                  <div key={label as string} className="border border-black bg-white p-4 shadow-sw-default">
                    <div className="font-semibold text-ink">{label as string}</div>
                    {Array.isArray(values) && values.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {values.map((value) => (
                          <span
                            key={value}
                            className="border border-black px-2.5 py-1 font-mono text-xs"
                          >
                            {value}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-steel-grey">暂无</div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="border-2 border-green-700 bg-green-50 p-5 shadow-sw-default">
              <div className="font-mono text-xs font-bold uppercase text-green-800">
                当前节点
              </div>
              <div className="mt-2 text-sm leading-6 text-green-900">
                已完成“上传/读取客户简历 → 展示结构化事实”。事实核验区仍然是只读模式，
                不会修改简历内容。上传动作会在 Resume Matcher 中新增一条主简历记录；当前后端最多保留 5 条主简历。
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
