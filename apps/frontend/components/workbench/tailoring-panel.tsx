'use client';

import { useCallback, useState } from 'react';
import type { ResumeData } from '@/components/dashboard/resume-component';
import type { ImprovedResult } from '@/components/common/resume_previewer_context';
import { DiffPreviewModal } from '@/components/tailor/diff-preview-modal';
import {
  confirmImproveResume,
  previewImproveResume,
  uploadJobDescriptions,
} from '@/lib/api/resume';

interface TailoringPanelProps {
  resumeId: string;
}

export function TailoringPanel({ resumeId }: TailoringPanelProps) {
  const [factsConfirmed, setFactsConfirmed] = useState(false);
  const [jobDescription, setJobDescription] = useState('');
  const [previewResult, setPreviewResult] = useState<ImprovedResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [savedResumeId, setSavedResumeId] = useState<string | null>(null);

  const unsafePreviewReason = (() => {
    const summary = previewResult?.data.diff_summary;
    if (!summary) return null;

    if (summary.skills_added > 0) {
      return `已检测到 ${summary.skills_added} 项新增技能。WorkBench V0.1 禁止保存任何新增技能，请拒绝并重新生成。`;
    }

    if (summary.certifications_added > 0) {
      return `已检测到 ${summary.certifications_added} 项新增证书。WorkBench V0.1 禁止保存任何新增证书，请拒绝并重新生成。`;
    }

    if (summary.high_risk_changes > 0) {
      return `已检测到 ${summary.high_risk_changes} 项高风险变更。WorkBench V0.1 仅允许低风险保守改写，因此禁止保存。`;
    }

    return null;
  })();

  const generatePreview = useCallback(async () => {
    const jd = jobDescription.trim();

    if (!factsConfirmed) {
      setError('请先确认原始简历事实无误。');
      return;
    }

    if (jd.length < 50) {
      setError('目标岗位 JD 至少需要 50 个字符。');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setConfirmError(null);
    setPreviewResult(null);
    setSavedResumeId(null);

    try {
      const jobId = await uploadJobDescriptions([jd], resumeId);
      const result = await previewImproveResume(resumeId, jobId, 'nudge', {
        maxBulletsPerEntry: 3,
      });

      if (!result.data.diff_summary || !result.data.detailed_changes) {
        throw new Error(
          'AI 已返回预览，但缺少差异审计数据。为保证人工验收，工作台拒绝进入批准环节。'
        );
      }

      setPreviewResult(result);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'AI 岗位定制预览生成失败。'
      );
    } finally {
      setIsGenerating(false);
    }
  }, [factsConfirmed, jobDescription, resumeId]);

  const rejectPreview = useCallback(() => {
    if (isConfirming) return;
    setPreviewResult(null);
    setConfirmError(null);
  }, [isConfirming]);

  const confirmPreview = useCallback(async () => {
    if (!previewResult || isConfirming) return;

    if (unsafePreviewReason) {
      setConfirmError(unsafePreviewReason);
      return;
    }

    const expiresAt = Date.parse(previewResult.data.preview_expires_at ?? '');
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
      setConfirmError('当前 AI 预览已经过期，请关闭审核窗口并重新生成。');
      return;
    }

    const preview = previewResult.data.resume_preview;
    if (!preview || typeof preview !== 'object' || Array.isArray(preview)) {
      setConfirmError('AI 预览结构无效，禁止保存。');
      return;
    }

    setIsConfirming(true);
    setConfirmError(null);

    try {
      const confirmed = await confirmImproveResume({
        resume_id: resumeId,
        job_id: previewResult.data.job_id,
        preview_id: previewResult.data.preview_id ?? null,
        improved_data: preview as unknown as ResumeData,
        improvements:
          previewResult.data.improvements?.map((item) => ({
            suggestion: item.suggestion,
            lineNumber: typeof item.lineNumber === 'number' ? item.lineNumber : null,
          })) ?? [],
      });

      const newResumeId = confirmed.data.resume_id;
      if (!newResumeId) {
        throw new Error('保存成功响应中缺少新的简历 ID。');
      }

      setSavedResumeId(newResumeId);
      setPreviewResult(null);
    } catch (failure) {
      setConfirmError(
        failure instanceof Error ? failure.message : '批准并保存岗位定制简历失败。'
      );
    } finally {
      setIsConfirming(false);
    }
  }, [isConfirming, previewResult, resumeId, unsafePreviewReason]);

  return (
    <>
      <section className="space-y-4 border-t-2 border-black pt-8">
        <div>
          <div className="font-mono text-xs font-bold uppercase text-blue-700">
            STEP 2 / FACT CONFIRM
          </div>
          <h2 className="mt-1 font-serif text-2xl font-bold text-ink">
            确认原始事实
          </h2>
          <p className="mt-1 text-sm leading-6 text-ink-soft">
            只有人工确认事实后，AI 按钮才会解锁。这里不会修改原始简历。
          </p>
        </div>

        <div
          className={
            factsConfirmed
              ? 'border-2 border-green-700 bg-green-50 p-5 shadow-sw-default'
              : 'border-2 border-black bg-white p-5 shadow-sw-default'
          }
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold text-ink">
                {factsConfirmed ? '事实核验已确认' : '等待人工确认'}
              </div>
              <div className="mt-1 text-sm text-ink-soft">
                请确认姓名、学校、公司、时间、项目、技能等均来自客户真实材料。
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setFactsConfirmed((value) => !value);
                setPreviewResult(null);
                setSavedResumeId(null);
                setError(null);
                setConfirmError(null);
              }}
              disabled={isGenerating || isConfirming}
              className={
                factsConfirmed
                  ? 'border-2 border-green-800 bg-green-700 px-5 py-2 font-mono text-xs font-bold uppercase text-white shadow-sw-default'
                  : 'border-2 border-black bg-blue-700 px-5 py-2 font-mono text-xs font-bold uppercase text-white shadow-sw-default'
              }
            >
              {factsConfirmed ? '取消确认' : '确认事实无误'}
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-4 border-t-2 border-black pt-8">
        <div>
          <div className="font-mono text-xs font-bold uppercase text-blue-700">
            STEP 3 / JOB DESCRIPTION
          </div>
          <h2 className="mt-1 font-serif text-2xl font-bold text-ink">
            输入目标岗位 JD
          </h2>
          <p className="mt-1 text-sm leading-6 text-ink-soft">
            AI 默认使用严格轻改模式（nudge）：只允许保守改写现有内容，不新增技能或新职责；在你人工批准前，不会保存新的岗位定制简历。
          </p>
        </div>

        <textarea
          value={jobDescription}
          onChange={(event) => {
            setJobDescription(event.target.value);
            setPreviewResult(null);
            setSavedResumeId(null);
            setError(null);
            setConfirmError(null);
          }}
          disabled={!factsConfirmed || isGenerating || isConfirming}
          placeholder="粘贴完整岗位 JD，建议包含职责、要求、技能关键词和加分项……"
          className="min-h-[260px] w-full resize-y border-2 border-black bg-white p-4 font-mono text-sm leading-6 outline-none focus:border-blue-700 disabled:bg-paper-tint disabled:opacity-60"
        />

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="font-mono text-xs text-steel-grey">
            {jobDescription.trim().length} 字符 / 最低 50
          </div>

          <button
            type="button"
            onClick={() => void generatePreview()}
            disabled={
              !factsConfirmed ||
              isGenerating ||
              isConfirming ||
              jobDescription.trim().length < 50
            }
            className="border-2 border-black bg-black px-5 py-2.5 font-mono text-xs font-bold uppercase text-white shadow-sw-default disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isGenerating ? 'AI 生成预览中...' : '生成岗位定制预览'}
          </button>
        </div>

        {error ? (
          <div
            className="border-2 border-red-600 bg-red-50 p-4 text-sm text-red-700"
            aria-live="polite"
          >
            {error}
          </div>
        ) : null}
      </section>

      <section className="space-y-4 border-t-2 border-black pt-8">
        <div>
          <div className="font-mono text-xs font-bold uppercase text-blue-700">
            STEP 4 / HUMAN REVIEW
          </div>
          <h2 className="mt-1 font-serif text-2xl font-bold text-ink">
            人工审核
          </h2>
        </div>

        {!previewResult && !savedResumeId ? (
          <div className="border border-dashed border-black bg-white p-5 text-sm text-ink-soft">
            生成预览后会打开 Resume Matcher 原生差异审核窗口。只有点击“批准”才会保存。
          </div>
        ) : null}

        {previewResult ? (
          <div
            className={
              unsafePreviewReason
                ? 'border-2 border-red-600 bg-red-50 p-5 shadow-sw-default'
                : 'border-2 border-amber-500 bg-amber-50 p-5 shadow-sw-default'
            }
          >
            <div className={unsafePreviewReason ? 'font-semibold text-red-800' : 'font-semibold text-amber-900'}>
              {unsafePreviewReason ? 'AI 预览被安全闸门拦截' : 'AI 预览已生成，等待人工审核'}
            </div>
            <div className={unsafePreviewReason ? 'mt-2 text-sm text-red-700' : 'mt-2 text-sm text-amber-800'}>
              共 {previewResult.data.diff_summary?.total_changes ?? 0} 项变化；
              高风险变化 {previewResult.data.diff_summary?.high_risk_changes ?? 0} 项。
            </div>
            {unsafePreviewReason ? (
              <div className="mt-3 text-sm font-semibold text-red-800">
                {unsafePreviewReason}
              </div>
            ) : null}
          </div>
        ) : null}

        {confirmError && !previewResult ? (
          <div className="border-2 border-red-600 bg-red-50 p-4 text-sm text-red-700">
            {confirmError}
          </div>
        ) : null}

        {savedResumeId ? (
          <div className="border-2 border-green-700 bg-green-50 p-5 shadow-sw-default">
            <div className="font-semibold text-green-900">
              人工批准完成，岗位定制简历已保存
            </div>
            <div className="mt-2 break-all font-mono text-xs text-green-800">
              Resume ID: {savedResumeId}
            </div>
          </div>
        ) : null}
      </section>

      <DiffPreviewModal
        isOpen={Boolean(previewResult)}
        isConfirming={isConfirming}
        onClose={rejectPreview}
        onReject={rejectPreview}
        onConfirm={() => void confirmPreview()}
        diffSummary={previewResult?.data.diff_summary}
        detailedChanges={previewResult?.data.detailed_changes}
        errorMessage={confirmError ?? undefined}
        selectionSummary={previewResult?.data.bullet_selection}
        confirmDisabled={Boolean(unsafePreviewReason)}
        confirmDisabledReason={unsafePreviewReason ?? undefined}
      />
    </>
  );
}
