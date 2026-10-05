<?php

declare(strict_types=1);

namespace Serviceform\AgenticSearch\Exception;

/**
 * A request to the Serviceform API failed: transport error, a non-2xx status
 * or a body that is not the expected JSON.
 */
class ApiException extends \RuntimeException
{
    /** @var int */
    private $status;

    /** @var string */
    private $url;

    /**
     * @param string          $message  What went wrong.
     * @param int             $status   HTTP status, 0 when no response arrived.
     * @param string          $url      The requested URL.
     * @param \Throwable|null $previous The underlying error, if any.
     */
    public function __construct(string $message, int $status = 0, string $url = '', ?\Throwable $previous = null)
    {
        parent::__construct($message, $status, $previous);
        $this->status = $status;
        $this->url = $url;
    }

    /**
     * HTTP status of the failed response, 0 when no response arrived.
     */
    public function getStatus(): int
    {
        return $this->status;
    }

    /**
     * The URL that was requested.
     */
    public function getUrl(): string
    {
        return $this->url;
    }
}
